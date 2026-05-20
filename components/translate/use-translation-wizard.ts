"use client";

import { useCallback, useMemo, useReducer, useRef } from "react";
import type { Invoice, LanguageCode } from "@/types/invoice";

// ─── Public types ─────────────────────────────────────────────────────────

export type WizardStep = "upload" | "language" | "delivery";

export type FileSlotStatus = "parsing" | "ready" | "error" | "duplicate";

export interface FileSlot {
  localId: string;
  file: File;
  status: FileSlotStatus;
  invoiceId?: string;
  invoiceNumber?: string;
  errorMessage?: string;
  warnings?: ReadonlyArray<string>;
}

export type JobItemStatus = "queued" | "translating" | "done" | "error";

export interface JobItem {
  fileSlotId: string;
  invoiceId: string;
  invoiceNumber: string;
  status: JobItemStatus;
  durationMs?: number;
  errorMessage?: string;
  /** Object URL produced from a client-side fetched preview blob, if any. */
  previewUrl?: string;
  /**
   * Whether this job consumed a credit. `false` for cache-hit responses
   * (server returns `cacheHit: true` and skips the ledger insert).
   * Drives the "Z cache — bez opłaty" badge in the row UI.
   */
  creditConsumed: boolean;
}

export interface WizardState {
  step: WizardStep;
  files: ReadonlyArray<FileSlot>;
  language: LanguageCode | null;
  bilingual: boolean;
  jobItems: ReadonlyArray<JobItem>;
  insufficientCredit: boolean;
}

// ─── Wizard API contract (injected for tests) ─────────────────────────────

export type UploadBatchResult =
  | {
      ok: true;
      fileName: string;
      invoiceId: string;
      invoiceNumber: string;
      warnings: ReadonlyArray<string>;
      isNew: boolean;
    }
  | {
      ok: false;
      fileName: string;
      error: string;
    };

export interface UploadBatchResponse {
  results: ReadonlyArray<UploadBatchResult>;
}

export type TranslateResult =
  | { ok: true; invoice: Invoice; cacheHit: boolean }
  | { ok: false; error: string; code?: "insufficient_credit" | "transient" | "fatal" };

export interface WizardApi {
  uploadBatch(files: ReadonlyArray<File>): Promise<UploadBatchResponse>;
  translate(
    invoiceId: string,
    language: LanguageCode,
    bilingual: boolean,
    signal?: AbortSignal
  ): Promise<TranslateResult>;
  generatePdf(
    invoiceId: string,
    language: LanguageCode | "pl",
    bilingual: boolean
  ): Promise<Blob>;
  downloadZip(
    invoiceIds: ReadonlyArray<string>,
    language: LanguageCode,
    bilingual: boolean
  ): Promise<Blob>;
}

export interface UseTranslationWizardOptions {
  api: WizardApi;
  /** Hydrate a partial state — used by /translate?invoiceId=… routing. */
  initialState?: Partial<WizardState>;
  /** Max parallel translate calls. Default 3 (matches OpenAI rate budget). */
  concurrency?: number;
}

export interface UseTranslationWizardResult {
  state: WizardState;
  /** Cost = ready-file count. Bilingual is free vs mono — same cache row. */
  cost: number;
  addFiles(files: ReadonlyArray<File>): Promise<void>;
  removeFile(localId: string): void;
  clearAll(): void;
  setLanguage(code: LanguageCode): void;
  setBilingual(value: boolean): void;
  goNext(): void;
  goBack(): void;
  startTranslation(): Promise<void>;
  cancelBatch(): void;
  resumeBatch(): Promise<void>;
  retryItem(fileSlotId: string): Promise<void>;
  reset(): void;
}

// ─── Internal state machine ───────────────────────────────────────────────

const INITIAL_STATE: WizardState = {
  step: "upload",
  files: [],
  language: null,
  bilingual: false,
  jobItems: [],
  insufficientCredit: false
};

function mergeInitialState(override?: Partial<WizardState>): WizardState {
  if (!override) return INITIAL_STATE;
  return {
    step: override.step ?? INITIAL_STATE.step,
    files: override.files ?? INITIAL_STATE.files,
    language: override.language ?? INITIAL_STATE.language,
    bilingual: override.bilingual ?? INITIAL_STATE.bilingual,
    jobItems: override.jobItems ?? INITIAL_STATE.jobItems,
    insufficientCredit:
      override.insufficientCredit ?? INITIAL_STATE.insufficientCredit
  };
}

type Action =
  | { type: "addFileSlots"; slots: ReadonlyArray<FileSlot> }
  | { type: "patchFileSlot"; localId: string; patch: Partial<FileSlot> }
  | { type: "removeFile"; localId: string }
  | { type: "clearAll" }
  | { type: "setLanguage"; language: LanguageCode | null }
  | { type: "setBilingual"; value: boolean }
  | { type: "goStep"; step: WizardStep }
  | { type: "setJobItems"; items: ReadonlyArray<JobItem> }
  | { type: "patchJobItem"; fileSlotId: string; patch: Partial<JobItem> }
  | { type: "reset" };

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "addFileSlots":
      return { ...state, files: [...state.files, ...action.slots] };
    case "patchFileSlot":
      return {
        ...state,
        files: state.files.map((slot) =>
          slot.localId === action.localId ? { ...slot, ...action.patch } : slot
        )
      };
    case "removeFile":
      return {
        ...state,
        files: state.files.filter((slot) => slot.localId !== action.localId)
      };
    case "clearAll":
      return { ...state, files: [] };
    case "setLanguage":
      return { ...state, language: action.language };
    case "setBilingual":
      return { ...state, bilingual: action.value };
    case "goStep":
      // When walking back to language from delivery, drop the in-flight job
      // items — the user is reconfiguring; jobs will be rebuilt on next start.
      if (action.step === "language" && state.step === "delivery") {
        return { ...state, step: "language", jobItems: [] };
      }
      return { ...state, step: action.step };
    case "setJobItems":
      return { ...state, jobItems: action.items };
    case "patchJobItem":
      return {
        ...state,
        jobItems: state.jobItems.map((j) =>
          j.fileSlotId === action.fileSlotId ? { ...j, ...action.patch } : j
        )
      };
    case "reset":
      return INITIAL_STATE;
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────

function makeLocalId(): string {
  // Stable across renders. Browser-safe — crypto.randomUUID exists in
  // jsdom (test env) and all supported browsers.
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `slot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function fileFingerprint(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

/**
 * Dedupe within the incoming batch AND against the existing roster.
 * Returns the unique-by-fingerprint subset.
 */
function dedupeAgainst(
  incoming: ReadonlyArray<File>,
  existing: ReadonlyArray<FileSlot>
): ReadonlyArray<File> {
  const seen = new Set(existing.map((slot) => fileFingerprint(slot.file)));
  const out: File[] = [];
  for (const file of incoming) {
    const fp = fileFingerprint(file);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(file);
  }
  return out;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useTranslationWizard({
  api,
  initialState,
  concurrency = 3
}: UseTranslationWizardOptions): UseTranslationWizardResult {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    mergeInitialState(initialState)
  );

  // AbortController for the active batch. Reused across retries (each
  // resumeBatch/retryItem swaps in a fresh one). Kept in a ref because
  // it isn't render state — the UI doesn't read it.
  const abortRef = useRef<AbortController | null>(null);
  // Live mutable references that update synchronously alongside dispatch().
  // useReducer dispatches are async (state lands on the next render), but
  // the translate runner runs fire-and-forget across renders and needs to
  // see writes the moment they happen. Pattern: every action that mutates
  // jobItems or other state goes through the helpers below, which patch
  // the ref *and* dispatch.
  const jobItemsRef = useRef<JobItem[]>([...state.jobItems]);
  const stateRef = useRef(state);
  stateRef.current = state;

  function setJobItems(items: ReadonlyArray<JobItem>): void {
    jobItemsRef.current = [...items];
    dispatch({ type: "setJobItems", items });
  }

  function patchJobItem(fileSlotId: string, patch: Partial<JobItem>): void {
    jobItemsRef.current = jobItemsRef.current.map((j) =>
      j.fileSlotId === fileSlotId ? { ...j, ...patch } : j
    );
    dispatch({ type: "patchJobItem", fileSlotId, patch });
  }

  // Cost preview — counts only files that successfully uploaded.
  const cost = useMemo(
    () => state.files.filter((slot) => slot.status === "ready").length,
    [state.files]
  );

  // ─── Step 1: upload ─────────────────────────────────────────────────────

  const addFiles = useCallback(
    async (files: ReadonlyArray<File>) => {
      // Client-side dedupe within this batch + against existing slots.
      const unique = dedupeAgainst(files, stateRef.current.files);
      if (unique.length === 0) return;

      // Insert all new slots in "parsing" first so the UI shows spinners
      // immediately. The reducer guarantees the slots array reference
      // changes — React commits before we await the upload.
      const slots: FileSlot[] = unique.map((file) => ({
        localId: makeLocalId(),
        file,
        status: "parsing"
      }));
      dispatch({ type: "addFileSlots", slots });

      let response: UploadBatchResponse;
      try {
        response = await api.uploadBatch(unique);
      } catch (error) {
        // Network/upload failure — mark every slot in this batch as error.
        const reason = error instanceof Error ? error.message : "Upload failed";
        for (const slot of slots) {
          dispatch({
            type: "patchFileSlot",
            localId: slot.localId,
            patch: { status: "error", errorMessage: reason }
          });
        }
        return;
      }

      // Match each result back to its slot by file name (order is preserved
      // by the server, but matching by name is more robust to mid-stream
      // reorders or partial responses).
      for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i];
        const result = response.results.find(
          (r) => r.fileName === slot.file.name
        );
        if (!result) {
          dispatch({
            type: "patchFileSlot",
            localId: slot.localId,
            patch: { status: "error", errorMessage: "Missing upload result" }
          });
          continue;
        }
        if (result.ok) {
          dispatch({
            type: "patchFileSlot",
            localId: slot.localId,
            patch: {
              status: "ready",
              invoiceId: result.invoiceId,
              invoiceNumber: result.invoiceNumber,
              warnings: result.warnings ?? []
            }
          });
        } else {
          dispatch({
            type: "patchFileSlot",
            localId: slot.localId,
            patch: { status: "error", errorMessage: result.error }
          });
        }
      }
    },
    [api]
  );

  const removeFile = useCallback((localId: string) => {
    dispatch({ type: "removeFile", localId });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: "clearAll" });
  }, []);

  // ─── Step 2: language & format ──────────────────────────────────────────

  const setLanguage = useCallback((code: LanguageCode) => {
    // PL is the source language — silently reject. The UI should never
    // surface PL as an option, but this is defense in depth.
    if ((code as string) === "pl") return;
    dispatch({ type: "setLanguage", language: code });
  }, []);

  const setBilingual = useCallback((value: boolean) => {
    dispatch({ type: "setBilingual", value });
  }, []);

  // ─── Step navigation ────────────────────────────────────────────────────

  const goNext = useCallback(() => {
    const current = stateRef.current;
    if (current.step === "upload") {
      // Allow advancement iff at least one file is ready. Files in `error`
      // are tolerated — they keep their slot for the user to remove.
      const anyReady = current.files.some((slot) => slot.status === "ready");
      if (!anyReady) return;
      dispatch({ type: "goStep", step: "language" });
      return;
    }
    if (current.step === "language") {
      if (current.language === null) return;
      // The actual delivery transition + job kick-off happens via
      // startTranslation(); goNext here is a no-op so the wizard's
      // primary CTA stays explicit.
      return;
    }
  }, []);

  const goBack = useCallback(() => {
    const current = stateRef.current;
    if (current.step === "language") {
      dispatch({ type: "goStep", step: "upload" });
    } else if (current.step === "delivery") {
      // Abort any in-flight work — the user is going back to reconfigure.
      abortRef.current?.abort();
      dispatch({ type: "goStep", step: "language" });
    }
  }, []);

  // ─── Step 3: translation runner ─────────────────────────────────────────

  /**
   * Execute a single translate call against the API and patch the
   * corresponding jobItem with the outcome. Honors the AbortSignal —
   * if the controller fires, the item transitions to "error" with the
   * cancelled-by-user message.
   */
  const runOne = useCallback(
    async (item: JobItem, signal: AbortSignal): Promise<void> => {
      const language = stateRef.current.language;
      const bilingual = stateRef.current.bilingual;
      if (!language) return;

      patchJobItem(item.fileSlotId, {
        status: "translating",
        errorMessage: undefined
      });
      const startedAt = Date.now();

      let result: TranslateResult;
      try {
        result = await api.translate(
          item.invoiceId,
          language,
          bilingual,
          signal
        );
      } catch (error) {
        const isAbort =
          error instanceof DOMException && error.name === "AbortError";
        patchJobItem(item.fileSlotId, {
          status: "error",
          errorMessage: isAbort
            ? "Anulowano przez użytkownika"
            : "Translation failed",
          durationMs: Date.now() - startedAt
        });
        return;
      }

      if (result.ok) {
        patchJobItem(item.fileSlotId, {
          status: "done",
          durationMs: Date.now() - startedAt,
          creditConsumed: !result.cacheHit
        });
      } else {
        patchJobItem(item.fileSlotId, {
          status: "error",
          errorMessage: result.error,
          durationMs: Date.now() - startedAt
        });
      }
    },
    [api]
  );

  /**
   * Concurrency-limited runner. Walks the live jobItemsRef list, picks
   * the next `queued` item, fires `runOne`, and replays until the queue
   * is empty or the controller aborts.
   *
   * Reads from jobItemsRef rather than React state so it sees the latest
   * writes synchronously — useReducer dispatches don't land until commit.
   */
  const drainQueue = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      const workers = Array.from({ length: concurrency }, async () => {
        while (!signal.aborted) {
          const next = jobItemsRef.current.find((j) => j.status === "queued");
          if (!next) return;
          // Optimistically claim the slot by flipping to "translating"
          // before awaiting, so concurrent workers won't pick it up.
          patchJobItem(next.fileSlotId, { status: "translating" });
          await runOne(next, signal);
        }
      });
      await Promise.all(workers);
    },
    [concurrency, runOne]
  );

  const startTranslation = useCallback(async () => {
    const current = stateRef.current;
    if (current.language === null) return;
    if (current.step !== "language") return;

    // Build jobItems from the ready files.
    const items: JobItem[] = current.files
      .filter((slot) => slot.status === "ready" && slot.invoiceId)
      .map((slot) => ({
        fileSlotId: slot.localId,
        invoiceId: slot.invoiceId!,
        invoiceNumber: slot.invoiceNumber ?? "",
        status: "queued",
        creditConsumed: true
      }));
    if (items.length === 0) return;

    setJobItems(items);
    dispatch({ type: "goStep", step: "delivery" });

    const controller = new AbortController();
    abortRef.current = controller;

    // Mark items "queued" → workers will pick them up.
    await drainQueue(controller.signal);
  }, [drainQueue]);

  const cancelBatch = useCallback(() => {
    abortRef.current?.abort();
    // Mark any not-yet-done item as cancelled. In-flight items will also
    // settle via their AbortError path inside runOne — that's OK, both
    // converge on status: "error".
    const updated: JobItem[] = jobItemsRef.current.map((j) =>
      j.status === "done"
        ? j
        : {
            ...j,
            status: "error",
            errorMessage: "Anulowano przez użytkownika"
          }
    );
    setJobItems(updated);
  }, []);

  const resumeBatch = useCallback(async () => {
    // Re-queue every item that was cancelled or errored — done items stay.
    const requeued: JobItem[] = jobItemsRef.current.map((j) =>
      j.status === "done"
        ? j
        : {
            ...j,
            status: "queued",
            errorMessage: undefined
          }
    );
    setJobItems(requeued);

    const controller = new AbortController();
    abortRef.current = controller;
    await drainQueue(controller.signal);
  }, [drainQueue]);

  const retryItem = useCallback(
    async (fileSlotId: string) => {
      const target = stateRef.current.jobItems.find(
        (j) => j.fileSlotId === fileSlotId
      );
      if (!target) return;

      const signal = abortRef.current?.signal ?? new AbortController().signal;
      await runOne({ ...target, status: "queued" }, signal);
    },
    [runOne]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  return {
    state,
    cost,
    addFiles,
    removeFile,
    clearAll,
    setLanguage,
    setBilingual,
    goNext,
    goBack,
    startTranslation,
    cancelBatch,
    resumeBatch,
    retryItem,
    reset
  };
}
