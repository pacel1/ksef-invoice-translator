"use client";

import { useState, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import type { DemoLang } from "@/lib/landing/demo-sample";
import type { DemoUpload } from "@/components/landing/demo/upload-panel";
import { captureClient } from "@/lib/analytics/client";

export interface DownloadGateCopy {
  gateHeading: string;
  emailLabel: string;
  emailPlaceholder: string;
  consent: string;
  marketingOptIn: string;
  submit: string;
  success: string;
  gateError: string;
  rateLimited: string;
  pdfFailed: string;
}

type Status = "idle" | "submitting" | "success" | "error" | "rate_limited" | "pdf_failed";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface DownloadGateProps {
  lang: DemoLang;
  t: DownloadGateCopy;
  upload?: DemoUpload | null;
}

export function DownloadGate({ lang, t, upload }: DownloadGateProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [email, setEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [token, setToken] = useState(siteKey ? "" : "dev");
  const [status, setStatus] = useState<Status>("idle");
  const turnstileRef = useRef<TurnstileInstance>(null);

  function fail(next: "error" | "rate_limited" | "pdf_failed") {
    setStatus(next);
    if (siteKey) {
      turnstileRef.current?.reset();
      setToken("");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!EMAIL_RE.test(email) || !token) return;
    const lane = upload ? "upload" : "sample";
    let emailEventSent = false;
    setStatus("submitting");
    try {
      const unlock = await fetch("/api/demo/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          lang,
          turnstileToken: token,
          marketingOptIn,
          source: upload ? "upload" : "sample"
        })
      });
      if (unlock.status === 429) {
        captureClient("demo_email_submitted", { status: "rate_limited", marketing_opt_in: marketingOptIn, lane });
        emailEventSent = true;
        return fail("rate_limited");
      }
      if (!unlock.ok) {
        captureClient("demo_email_submitted", { status: "error", marketing_opt_in: marketingOptIn, lane });
        emailEventSent = true;
        return fail("error");
      }
      captureClient("demo_email_submitted", { status: "success", marketing_opt_in: marketingOptIn, lane });
      emailEventSent = true;
      const { downloadToken } = (await unlock.json()) as { downloadToken: string };

      const pdf = await fetch("/api/demo/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          upload
            ? { downloadToken, invoice: upload.invoice, sourceXml: upload.sourceXml, uploadToken: upload.uploadToken }
            : { downloadToken }
        )
      });
      if (pdf.status === 429) return fail("rate_limited");
      if (!pdf.ok) return fail("pdf_failed");
      captureClient("demo_pdf_downloaded", { language: upload ? upload.lang : lang, lane });
      triggerDownload(await pdf.blob(), `tlumaczksef-demo-${upload ? upload.lang : lang}.pdf`);
      setStatus("success");
    } catch {
      if (!emailEventSent) {
        captureClient("demo_email_submitted", { status: "error", marketing_opt_in: marketingOptIn, lane });
      }
      fail("error");
    }
  }

  if (status === "success") {
    return <p className="text-[14px] text-white/80">{t.success}</p>;
  }

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-sm flex-col gap-3 text-left">
      <h3 className="text-center font-heading text-[16px] font-semibold text-white">{t.gateHeading}</h3>
      <label className="text-[12px] font-medium text-white/70" htmlFor="demo-email">{t.emailLabel}</label>
      <input
        id="demo-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t.emailPlaceholder}
        className="rounded-xl border border-white/15 bg-ink-panel px-4 py-2.5 text-[14px] text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
      />
      <label className="flex items-start gap-2 text-[12px] text-white/60">
        <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} className="mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink" />
        {t.marketingOptIn}
      </label>
      {siteKey ? <Turnstile ref={turnstileRef} siteKey={siteKey} onSuccess={setToken} onExpire={() => setToken("")} onError={() => setToken("")} options={{ theme: "dark" }} /> : null}
      <button
        type="submit"
        disabled={status === "submitting" || !token}
        aria-busy={status === "submitting"}
        className="inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-[15px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
      >
        {t.submit}
      </button>
      <p className="text-center text-[12px] text-white/50">{t.consent}</p>
      {status === "error" ? <p role="alert" className="text-center text-[12px] text-negative">{t.gateError}</p> : null}
      {status === "rate_limited" ? <p role="alert" className="text-center text-[12px] text-white/80">{t.rateLimited}</p> : null}
      {status === "pdf_failed" ? <p role="alert" className="text-center text-[12px] text-negative">{t.pdfFailed}</p> : null}
    </form>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default DownloadGate;
