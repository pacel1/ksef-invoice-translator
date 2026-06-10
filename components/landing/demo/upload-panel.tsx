"use client";

import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import type { Invoice } from "@/types/invoice";
import type { DemoLang } from "@/lib/landing/demo-sample";
import { DEMO_UPLOAD_ACCEPT, detectDemoUploadType, maxBytesFor } from "@/lib/demo/upload-limits";
import { cn } from "@/lib/utils";

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
      void translate(fileRef.current, lang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  function handleFiles(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    const type = detectDemoUploadType(file.name, file.type);
    if (!type) {
      setErrorKey("uploadErrUnsupported");
      return;
    }
    if (file.size > maxBytesFor(type)) {
      setErrorKey("uploadErrTooLarge");
      return;
    }
    fileRef.current = file;
    void translate(file, lang);
  }

  async function translate(file: File, target: DemoLang) {
    if (siteKey && !token) {
      // Tokens are single use and the widget re-solves after each reset; queue
      // the request and let onToken fire it when a fresh token lands.
      setBusy(true);
      setErrorKey(null);
      setPendingLang(target);
      return;
    }
    await doTranslate(file, target, token);
  }

  async function doTranslate(file: File, target: DemoLang, turnstileToken: string) {
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
        setErrorKey(STATUS_ERRORS[res.status] ?? "uploadErrTranslate");
        return;
      }
      const data = (await res.json()) as { invoice: Invoice; sourceXml: string; uploadToken: string };
      translatedLangRef.current = target;
      onResult({ invoice: data.invoice, sourceXml: data.sourceXml, uploadToken: data.uploadToken, lang: target });
    } catch {
      setErrorKey("uploadErrTranslate");
    } finally {
      setBusy(false);
    }
  }

  function onToken(next: string) {
    setToken(next);
    if (pendingLang && fileRef.current) {
      const target = pendingLang;
      setPendingLang(null);
      void doTranslate(fileRef.current, target, next);
    }
  }

  function failQueuedTranslate() {
    setToken("");
    if (pendingLang) {
      setPendingLang(null);
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
