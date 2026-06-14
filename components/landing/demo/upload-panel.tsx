"use client";

import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import type { Invoice } from "@/types/invoice";
import type { DemoLang } from "@/lib/landing/demo-sample";
import { DEMO_UPLOAD_ACCEPT, isDemoXmlUpload, maxXmlBytes } from "@/lib/demo/upload-limits";
import { cn } from "@/lib/utils";
import { captureClient } from "@/lib/analytics/client";
import { demoErrorCodeFromStatus, isRateLimited } from "@/lib/analytics/demo-status";

/** What Lane 2 hands to the stage and the download gate. Held only in client memory. */
export interface DemoUpload {
  invoice: Invoice;
  sourceXml: string;
  uploadToken: string;
  lang: DemoLang;
}

export interface UploadPanelCopy {
  uploadLink: string;
  uploadDropLabel: string;
  uploadHint: string;
  uploadBusy: string;
  rateLimited: string;
  uploadErrUnsupported: string;
  uploadErrTooLarge: string;
  uploadErrParse: string;
  uploadErrBreaker: string;
  uploadErrTurnstile: string;
  uploadErrTranslate: string;
}

type ErrorKey =
  | "uploadErrUnsupported"
  | "uploadErrTooLarge"
  | "uploadErrParse"
  | "rateLimited"
  | "uploadErrBreaker"
  | "uploadErrTurnstile"
  | "uploadErrTranslate";

const STATUS_ERRORS: Record<number, ErrorKey> = {
  415: "uploadErrUnsupported",
  413: "uploadErrTooLarge",
  422: "uploadErrParse",
  429: "rateLimited",
  503: "uploadErrBreaker",
  403: "uploadErrTurnstile"
};

export interface UploadPanelProps {
  lang: DemoLang;
  t: UploadPanelCopy;
  onResult: (upload: DemoUpload) => void;
}

export function UploadPanel({ lang, t, onResult }: UploadPanelProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [token, setToken] = useState(siteKey ? "" : "dev");
  const [pendingLang, setPendingLang] = useState<DemoLang | null>(null);
  // Preserves the "this is a real file selection" flag across the Turnstile
  // token queue so demo_file_uploaded fires once even when the request is
  // deferred until a fresh token lands.
  const pendingCountAsUpload = useRef(false);
  const fileRef = useRef<File | null>(null);
  const translatedLangRef = useRef<DemoLang | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Spec: switching language after an upload re-translates the retained file
  // (each call counts against the per-IP cap). On failure the previous result
  // stays on the stage and an inline error explains why.
  // Deliberately keyed on lang only: translate() re-reads the latest token via
  // state and the file via a ref, so wider deps would double-fire the request.
  useEffect(() => {
    if (fileRef.current && translatedLangRef.current && translatedLangRef.current !== lang) {
      // Language-switch re-translate: counts as a translation outcome but not a
      // new file upload, so demo_file_uploaded is not re-fired.
      void translate(fileRef.current, lang, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  function handleFiles(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    if (!isDemoXmlUpload(file.name, file.type)) {
      captureClient("demo_file_uploaded", { status: "invalid", error_code: "unsupported" });
      setErrorKey("uploadErrUnsupported");
      return;
    }
    if (file.size > maxXmlBytes()) {
      captureClient("demo_file_uploaded", { status: "invalid", error_code: "too_large" });
      setErrorKey("uploadErrTooLarge");
      return;
    }
    fileRef.current = file;
    void translate(file, lang, true);
  }

  async function translate(file: File, target: DemoLang, countAsUpload: boolean) {
    if (siteKey && !token) {
      // Tokens are single use and the widget re-solves after each reset; queue
      // the request and let onToken fire it when a fresh token lands.
      setBusy(true);
      setErrorKey(null);
      setPendingLang(target);
      pendingCountAsUpload.current = countAsUpload;
      return;
    }
    await doTranslate(file, target, token, countAsUpload);
  }

  async function doTranslate(
    file: File,
    target: DemoLang,
    turnstileToken: string,
    countAsUpload: boolean
  ) {
    if (siteKey) {
      turnstileRef.current?.reset();
      setToken("");
    }
    setBusy(true);
    setErrorKey(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("lang", target);
      form.set("turnstileToken", turnstileToken);
      const res = await fetch("/api/demo/translate", { method: "POST", body: form });
      if (!res.ok) {
        const error_code = demoErrorCodeFromStatus(res.status);
        if (countAsUpload) {
          captureClient("demo_file_uploaded", {
            status: isRateLimited(res.status) ? "rate_limited" : "error",
            error_code
          });
        }
        captureClient("demo_translation_failed", { language: target, lane: "upload", error_code });
        setErrorKey(STATUS_ERRORS[res.status] ?? "uploadErrTranslate");
        return;
      }
      const data = (await res.json()) as { invoice: Invoice; sourceXml: string; uploadToken: string };
      translatedLangRef.current = target;
      if (countAsUpload) {
        captureClient("demo_file_uploaded", { status: "success" });
      }
      captureClient("demo_translation_completed", { language: target, lane: "upload" });
      onResult({ invoice: data.invoice, sourceXml: data.sourceXml, uploadToken: data.uploadToken, lang: target });
    } catch {
      if (countAsUpload) {
        captureClient("demo_file_uploaded", { status: "error", error_code: "network" });
      }
      captureClient("demo_translation_failed", { language: target, lane: "upload", error_code: "network" });
      setErrorKey("uploadErrTranslate");
    } finally {
      setBusy(false);
    }
  }

  function onToken(next: string) {
    setToken(next);
    if (pendingLang && fileRef.current) {
      const target = pendingLang;
      const countAsUpload = pendingCountAsUpload.current;
      setPendingLang(null);
      pendingCountAsUpload.current = false;
      void doTranslate(fileRef.current, target, next, countAsUpload);
    }
  }

  function failQueuedTranslate() {
    setToken("");
    if (pendingLang) {
      setPendingLang(null);
      pendingCountAsUpload.current = false;
      setBusy(false);
      setErrorKey("uploadErrTurnstile");
    }
  }

  if (!open) {
    return (
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[14px] font-medium text-white/70 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
        >
          {t.uploadLink}
        </button>
      </div>
    );
  }

  const softError = errorKey === "rateLimited" || errorKey === "uploadErrBreaker";

  return (
    <div className="mx-auto mt-6 flex w-full max-w-sm flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        disabled={busy}
        aria-busy={busy}
        className={cn(
          "w-full rounded-2xl border border-dashed border-white/25 bg-ink-panel px-6 py-7 text-center transition-colors hover:border-white/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
          busy && "opacity-60"
        )}
      >
        <span className="block text-[14px] font-medium text-white/85">{busy ? t.uploadBusy : t.uploadDropLabel}</span>
        <span className="mt-1 block text-[12px] text-white/50">{t.uploadHint}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={DEMO_UPLOAD_ACCEPT}
        aria-label={t.uploadDropLabel}
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {siteKey ? (
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          onSuccess={onToken}
          onExpire={failQueuedTranslate}
          onError={failQueuedTranslate}
          options={{ theme: "dark" }}
        />
      ) : null}
      {errorKey ? (
        <p role="alert" className={cn("text-center text-[12px]", softError ? "text-white/80" : "text-negative")}>
          {t[errorKey]}
        </p>
      ) : null}
    </div>
  );
}

export default UploadPanel;
