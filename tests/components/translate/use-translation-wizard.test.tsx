import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useTranslationWizard,
  type WizardApi,
  type UploadBatchResult
} from "@/components/translate/use-translation-wizard";
import type { Invoice, LanguageCode } from "@/types/invoice";

/**
 * Spine of the Tłumacz wizard.
 *
 * The hook is the only place state transitions happen — the UI components
 * are dumb renderers. The contract under test:
 *
 *   1. Pure transitions: every state mutation returns a NEW object.
 *      (Forbidden by ~/.claude/rules/common/coding-style.md to mutate.)
 *
 *   2. No surprise side effects: translation never fires from a useEffect
 *      reacting to language selection — the user must explicitly call
 *      startTranslation(). Fixing the #1 defect in spec §1.1 (current
 *      translator-workspace auto-fires translation on language pill tap).
 *
 *   3. Cancel is honest: AbortController abort flows through to in-flight
 *      fetches; queued items never start.
 *
 *   4. Recent-row hydration works: initialState seeds the state machine
 *      at any step so `/translate?invoiceId=…` can land in delivery
 *      directly.
 */

const sampleInvoice = {
  invoiceNumber: "FA-2026-0001",
  issueDate: "2026-01-15",
  currency: "PLN",
  totalGross: 1230
} as unknown as Invoice;

/**
 * Tiny deterministic stub of the upload + translate APIs the wizard calls.
 * Tests opt into success/failure behavior per call.
 */
function makeStubApi(overrides: Partial<WizardApi> = {}): WizardApi {
  return {
    uploadBatch: vi.fn(async (files: File[]) => ({
      results: files.map((file, i) => ({
        ok: true as const,
        fileName: file.name,
        invoiceId: `inv-${i + 1}`,
        invoiceNumber: `FA-2026-${String(i + 1).padStart(4, "0")}`,
        warnings: [],
        isNew: true
      }))
    })),
    translate: vi.fn(async () => ({
      ok: true as const,
      invoice: sampleInvoice,
      cacheHit: false
    })),
    generatePdf: vi.fn(async () => new Blob(["pdf"], { type: "application/pdf" })),
    downloadZip: vi.fn(async () => new Blob(["zip"], { type: "application/zip" })),
    ...overrides
  };
}

function makeFile(name: string, size = 1024) {
  return new File([new Uint8Array(size)], name, { type: "application/xml" });
}

describe("useTranslationWizard — initial state", () => {
  it("starts on the upload step with no files, no language, no jobs", () => {
    const { result } = renderHook(() => useTranslationWizard({ api: makeStubApi() }));
    expect(result.current.state.step).toBe("upload");
    expect(result.current.state.files).toEqual([]);
    expect(result.current.state.language).toBeNull();
    expect(result.current.state.bilingual).toBe(false);
    expect(result.current.state.jobItems).toEqual([]);
    expect(result.current.state.insufficientCredit).toBe(false);
  });

  it("accepts a partial initialState for /translate?invoiceId hydration", () => {
    const { result } = renderHook(() =>
      useTranslationWizard({
        api: makeStubApi(),
        initialState: {
          step: "delivery",
          jobItems: [
            {
              fileSlotId: "preseed-1",
              invoiceId: "inv-9",
              invoiceNumber: "FA-2026-0009",
              status: "done",
              creditConsumed: false
            }
          ]
        }
      })
    );
    expect(result.current.state.step).toBe("delivery");
    expect(result.current.state.jobItems).toHaveLength(1);
    expect(result.current.state.jobItems[0].status).toBe("done");
  });
});

describe("useTranslationWizard — Step 1 upload", () => {
  it("addFiles transitions each new slot to 'parsing' with a stable localId", async () => {
    const api = makeStubApi();
    const { result } = renderHook(() => useTranslationWizard({ api }));

    const f1 = makeFile("a.xml");
    const f2 = makeFile("b.xml");

    await act(async () => {
      await result.current.addFiles([f1, f2]);
    });

    // After the awaited addFiles, the upload promise has resolved →
    // both slots are in 'ready'. Inspect the local ids — they must be
    // present, unique, and stable.
    const ids = result.current.state.files.map((f) => f.localId);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
  });

  it("transitions files to 'ready' once uploadBatch resolves with invoiceId", async () => {
    const api = makeStubApi();
    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([makeFile("a.xml")]);
    });

    expect(result.current.state.files[0].status).toBe("ready");
    expect(result.current.state.files[0].invoiceId).toBe("inv-1");
    expect(result.current.state.files[0].invoiceNumber).toBe("FA-2026-0001");
  });

  it("marks a server-rejected file as 'error' with the message and keeps siblings ready", async () => {
    const api = makeStubApi({
      uploadBatch: vi.fn(async (files: File[]) => ({
        results: files.map((file, i): UploadBatchResult =>
          file.name === "broken.xml"
            ? { ok: false, fileName: file.name, error: "Bad XML" }
            : {
                ok: true,
                fileName: file.name,
                invoiceId: `inv-${i + 1}`,
                invoiceNumber: `FA-${i + 1}`,
                warnings: [],
                isNew: true
              }
        )
      }))
    });

    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([makeFile("a.xml"), makeFile("broken.xml")]);
    });

    expect(result.current.state.files[0].status).toBe("ready");
    expect(result.current.state.files[1].status).toBe("error");
    expect(result.current.state.files[1].errorMessage).toBe("Bad XML");
  });

  it("removeFile drops only the targeted slot, preserves order", async () => {
    const api = makeStubApi();
    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([
        makeFile("a.xml"),
        makeFile("b.xml"),
        makeFile("c.xml")
      ]);
    });

    const middleId = result.current.state.files[1].localId;
    act(() => result.current.removeFile(middleId));

    expect(result.current.state.files).toHaveLength(2);
    expect(result.current.state.files.map((f) => f.localId)).not.toContain(
      middleId
    );
  });

  it("clearAll empties the files list", async () => {
    const api = makeStubApi();
    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([makeFile("a.xml")]);
    });

    act(() => result.current.clearAll());
    expect(result.current.state.files).toEqual([]);
  });

  it("client-side dedupes identical (name, size, lastModified) within one batch", async () => {
    const api = makeStubApi();
    const { result } = renderHook(() => useTranslationWizard({ api }));

    // Construct two refs to a file with identical signature.
    const f = makeFile("dup.xml", 512);
    const fClone = new File([new Uint8Array(512)], "dup.xml", {
      type: "application/xml",
      lastModified: f.lastModified
    });

    await act(async () => {
      await result.current.addFiles([f, fClone]);
    });

    expect(result.current.state.files).toHaveLength(1);
    // uploadBatch should only be called with 1 file, not 2.
    const apiCall = api.uploadBatch as ReturnType<typeof vi.fn>;
    expect(apiCall.mock.calls[0][0]).toHaveLength(1);
  });
});

describe("useTranslationWizard — step navigation", () => {
  it("goNext from upload requires every file to be 'ready' (else no-op)", async () => {
    const api = makeStubApi({
      uploadBatch: vi.fn(async (files: File[]) => ({
        results: files.map(
          (file): UploadBatchResult => ({ ok: false, fileName: file.name, error: "x" })
        )
      }))
    });

    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([makeFile("a.xml")]);
    });

    expect(result.current.state.files[0].status).toBe("error");

    act(() => result.current.goNext());
    // Stayed on the upload step because the only file is in error.
    expect(result.current.state.step).toBe("upload");
  });

  it("goNext from upload → language step when ≥1 ready file exists", async () => {
    const api = makeStubApi();
    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([makeFile("a.xml")]);
    });

    act(() => result.current.goNext());
    expect(result.current.state.step).toBe("language");
  });

  it("setLanguage('pl') is a no-op — Polish is the source", async () => {
    const api = makeStubApi();
    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([makeFile("a.xml")]);
    });
    act(() => result.current.goNext());

    act(() => result.current.setLanguage("pl" as LanguageCode));
    expect(result.current.state.language).toBeNull();
  });

  it("setLanguage accepts a valid LanguageCode", async () => {
    const api = makeStubApi();
    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([makeFile("a.xml")]);
    });
    act(() => result.current.goNext());

    act(() => result.current.setLanguage("de"));
    expect(result.current.state.language).toBe("de");
  });

  it("setBilingual toggles the flag", () => {
    const { result } = renderHook(() => useTranslationWizard({ api: makeStubApi() }));
    expect(result.current.state.bilingual).toBe(false);
    act(() => result.current.setBilingual(true));
    expect(result.current.state.bilingual).toBe(true);
    act(() => result.current.setBilingual(false));
    expect(result.current.state.bilingual).toBe(false);
  });

  it("startTranslation requires language !== null (no-op otherwise)", async () => {
    const api = makeStubApi();
    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([makeFile("a.xml")]);
    });
    act(() => result.current.goNext()); // → language

    await act(async () => {
      await result.current.startTranslation();
    });

    expect(result.current.state.step).toBe("language");
    expect(api.translate).not.toHaveBeenCalled();
  });

  it("startTranslation builds jobItems from ready files and transitions to delivery", async () => {
    const api = makeStubApi();
    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([makeFile("a.xml"), makeFile("b.xml")]);
    });
    act(() => result.current.goNext());
    act(() => result.current.setLanguage("en"));

    await act(async () => {
      await result.current.startTranslation();
    });

    expect(result.current.state.step).toBe("delivery");
    expect(result.current.state.jobItems).toHaveLength(2);
    expect(result.current.state.jobItems.every((j) => j.status === "done")).toBe(true);
  });

  it("goBack from language → upload (files preserved)", async () => {
    const api = makeStubApi();
    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([makeFile("a.xml")]);
    });
    act(() => result.current.goNext());

    act(() => result.current.goBack());
    expect(result.current.state.step).toBe("upload");
    expect(result.current.state.files).toHaveLength(1);
  });

  it("goBack from delivery → language (files + lang preserved, jobItems cleared)", async () => {
    const api = makeStubApi();
    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([makeFile("a.xml")]);
    });
    act(() => result.current.goNext());
    act(() => result.current.setLanguage("en"));
    await act(async () => result.current.startTranslation());

    act(() => result.current.goBack());
    expect(result.current.state.step).toBe("language");
    expect(result.current.state.files).toHaveLength(1);
    expect(result.current.state.language).toBe("en");
    expect(result.current.state.jobItems).toEqual([]);
  });

  it("reset returns to a fresh initial state", async () => {
    const api = makeStubApi();
    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([makeFile("a.xml")]);
    });
    act(() => result.current.goNext());
    act(() => result.current.setLanguage("de"));
    act(() => result.current.setBilingual(true));

    act(() => result.current.reset());

    expect(result.current.state.step).toBe("upload");
    expect(result.current.state.files).toEqual([]);
    expect(result.current.state.language).toBeNull();
    expect(result.current.state.bilingual).toBe(false);
  });
});

describe("useTranslationWizard — Step 3 batch behavior", () => {
  it("respects the parallelism cap (3 concurrent translate calls max)", async () => {
    let inflight = 0;
    let maxObserved = 0;
    const api = makeStubApi({
      translate: vi.fn(async () => {
        inflight += 1;
        maxObserved = Math.max(maxObserved, inflight);
        await new Promise((r) => setTimeout(r, 5));
        inflight -= 1;
        return { ok: true as const, invoice: sampleInvoice, cacheHit: false };
      })
    });

    const { result } = renderHook(() => useTranslationWizard({ api, concurrency: 3 }));
    const files = Array.from({ length: 9 }, (_, i) => makeFile(`f${i}.xml`));

    await act(async () => {
      await result.current.addFiles(files);
    });
    act(() => result.current.goNext());
    act(() => result.current.setLanguage("en"));
    await act(async () => result.current.startTranslation());

    expect(maxObserved).toBeLessThanOrEqual(3);
    expect(result.current.state.jobItems.every((j) => j.status === "done")).toBe(true);
  });

  it("marks per-item failure without halting the batch", async () => {
    let call = 0;
    const api = makeStubApi({
      translate: vi.fn(async () => {
        call += 1;
        if (call === 2) {
          return { ok: false as const, error: "OpenAI 502" };
        }
        return { ok: true as const, invoice: sampleInvoice, cacheHit: false };
      })
    });

    const { result } = renderHook(() => useTranslationWizard({ api, concurrency: 1 }));

    await act(async () => {
      await result.current.addFiles([
        makeFile("a.xml"),
        makeFile("b.xml"),
        makeFile("c.xml")
      ]);
    });
    act(() => result.current.goNext());
    act(() => result.current.setLanguage("en"));
    await act(async () => result.current.startTranslation());

    const items = result.current.state.jobItems;
    expect(items[0].status).toBe("done");
    expect(items[1].status).toBe("error");
    expect(items[1].errorMessage).toBe("OpenAI 502");
    expect(items[2].status).toBe("done");
  });

  it("flags cacheHit responses so the UI can mark the row 'Z cache'", async () => {
    const api = makeStubApi({
      translate: vi.fn(async () => ({
        ok: true as const,
        invoice: sampleInvoice,
        cacheHit: true
      }))
    });
    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([makeFile("a.xml")]);
    });
    act(() => result.current.goNext());
    act(() => result.current.setLanguage("en"));
    await act(async () => result.current.startTranslation());

    expect(result.current.state.jobItems[0].creditConsumed).toBe(false);
  });

  it("cancelBatch marks all non-done items as cancelled and stops queue", async () => {
    let cancelMidway = false;
    const api = makeStubApi({
      translate: vi.fn(async (_invoiceId, _lang, _bilingual, signal?: AbortSignal) => {
        if (cancelMidway) {
          if (signal?.aborted) throw new DOMException("aborted", "AbortError");
          await new Promise((resolve, reject) => {
            const handler = () => reject(new DOMException("aborted", "AbortError"));
            signal?.addEventListener("abort", handler);
            setTimeout(() => {
              signal?.removeEventListener("abort", handler);
              resolve(null);
            }, 50);
          });
        }
        return { ok: true as const, invoice: sampleInvoice, cacheHit: false };
      })
    });

    const { result } = renderHook(() => useTranslationWizard({ api, concurrency: 1 }));

    await act(async () => {
      await result.current.addFiles([
        makeFile("a.xml"),
        makeFile("b.xml"),
        makeFile("c.xml")
      ]);
    });
    act(() => result.current.goNext());
    act(() => result.current.setLanguage("en"));

    // Start the batch but cancel before all items finish.
    cancelMidway = true;
    const startPromise = act(async () => {
      await result.current.startTranslation();
    });

    // Give the runner a tick to start item 1.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    act(() => result.current.cancelBatch());
    await startPromise;

    const items = result.current.state.jobItems;
    // First item was in-flight when cancelled — should be 'error' with cancelled msg.
    // Items 2 and 3 were queued — should be 'error' with cancelled msg.
    const cancelled = items.filter((j) => j.status === "error");
    expect(cancelled.length).toBeGreaterThanOrEqual(2);
  });

  it("retryItem retries a single failed translation", async () => {
    let call = 0;
    const api = makeStubApi({
      translate: vi.fn(async () => {
        call += 1;
        if (call === 1) return { ok: false as const, error: "transient" };
        return { ok: true as const, invoice: sampleInvoice, cacheHit: false };
      })
    });

    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([makeFile("a.xml")]);
    });
    act(() => result.current.goNext());
    act(() => result.current.setLanguage("en"));
    await act(async () => result.current.startTranslation());

    expect(result.current.state.jobItems[0].status).toBe("error");

    const slotId = result.current.state.jobItems[0].fileSlotId;
    await act(async () => {
      await result.current.retryItem(slotId);
    });

    expect(result.current.state.jobItems[0].status).toBe("done");
  });
});

describe("useTranslationWizard — immutability", () => {
  it("returns a NEW state object on every transition (no in-place mutation)", async () => {
    const api = makeStubApi();
    const { result } = renderHook(() => useTranslationWizard({ api }));

    const s0 = result.current.state;
    await act(async () => {
      await result.current.addFiles([makeFile("a.xml")]);
    });
    const s1 = result.current.state;

    act(() => result.current.goNext());
    const s2 = result.current.state;

    expect(s1).not.toBe(s0);
    expect(s2).not.toBe(s1);
    // The original files array must not have been mutated in place.
    expect(s0.files).toEqual([]);
  });
});

describe("useTranslationWizard — cost computation", () => {
  it("cost equals the number of ready files at Step 2", async () => {
    const api = makeStubApi({
      uploadBatch: vi.fn(async (files: File[]) => ({
        results: files.map((file, i): UploadBatchResult =>
          file.name === "bad.xml"
            ? { ok: false, fileName: file.name, error: "bad" }
            : {
                ok: true,
                fileName: file.name,
                invoiceId: `inv-${i + 1}`,
                invoiceNumber: `FA-${i + 1}`,
                warnings: [],
                isNew: true
              }
        )
      }))
    });

    const { result } = renderHook(() => useTranslationWizard({ api }));

    await act(async () => {
      await result.current.addFiles([
        makeFile("a.xml"),
        makeFile("bad.xml"),
        makeFile("c.xml")
      ]);
    });
    act(() => result.current.goNext());

    expect(result.current.cost).toBe(2);
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
