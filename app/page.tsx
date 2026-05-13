"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  Download,
  FileText,
  Languages,
  Loader2,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  UploadCloud
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoicePreview } from "@/components/invoice-preview";
import { parseKsefXml } from "@/lib/xml/parser";
import { buildKsefXmlVerificationLink } from "@/lib/xml/verification";
import { getLanguageOptions } from "@/lib/translation/languages";
import type { Invoice, LanguageCode } from "@/types/invoice";
import { copy, type UiLanguage } from "@/lib/workspace/copy";

const ksefVerificationMessages = {
  confirmed: "Faktura została odnaleziona w KSeF. Numer KSeF został dodany do wygenerowanej faktury.",
  notConfirmed:
    "Nie udało się potwierdzić faktury w KSeF na podstawie publicznego linku weryfikacyjnego. Blok QR/link/numer KSeF nie został dodany do faktury."
};

export default function Home() {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("pl");
  const [messages, setMessages] = useState<string[]>([]);
  const [bilingual, setBilingual] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const t = copy[uiLanguage];
  const languageOptions = useMemo(() => getLanguageOptions(uiLanguage), [uiLanguage]);
  const selectedLanguage = useMemo(
    () => languageOptions.find((option) => option.code === language)?.label ?? language,
    [language, languageOptions]
  );

  async function handleFile(file?: File) {
    if (!file) return;
    setMessages([]);
    setInvoice(null);

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setIsParsing(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/parse-pdf", {
          method: "POST",
          body: formData
        });
        const payload = await response.json();

        if (!response.ok) {
          setInvoice(null);
          setMessages([payload.error ?? String(t.parsePdfFailed)]);
          return;
        }

        setInvoice(payload.invoice);
        setMessages(payload.warnings ?? []);
        if (payload.invoice?.verification?.qrLink) {
          void verifyKsefForPreview(payload.invoice.verification.qrLink);
        }
      } catch (error) {
        setInvoice(null);
        setMessages([error instanceof Error ? error.message : String(t.parsePdfFailed)]);
      } finally {
        setIsParsing(false);
      }
      return;
    }

    const xmlBytes = await file.arrayBuffer();
    const xml = new TextDecoder().decode(xmlBytes);
    const parsed = parseKsefXml(xml);
    if (!parsed.ok) {
      setInvoice(null);
      setMessages([parsed.error]);
      return;
    }

    const qrLink = await buildKsefXmlVerificationLink(
      xmlBytes,
      parsed.invoice.issueDate,
      parsed.invoice.seller.vatId
    );
    const invoiceWithVerification: Invoice = qrLink
      ? {
          ...parsed.invoice,
          verification: {
            ...parsed.invoice.verification,
            qrLink
          }
        }
      : parsed.invoice;

    setInvoice(invoiceWithVerification);
    setMessages(qrLink ? parsed.warnings : [...parsed.warnings, "Unable to build KSeF XML verification link: missing seller NIP or issue date."]);
    if (qrLink) {
      void verifyKsefForPreview(qrLink);
    }
  }

  async function verifyKsefForPreview(verificationUrl: string) {
    try {
      const response = await fetch("/api/verify-ksef", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationUrl })
      });
      const result = await response.json();

      if (result.confirmed && result.ksefNumber) {
        setInvoice((currentInvoice) =>
          currentInvoice?.verification?.qrLink === verificationUrl
            ? {
                ...currentInvoice,
                verification: {
                  ...currentInvoice.verification,
                  ksefNumber: result.ksefNumber
                }
              }
            : currentInvoice
        );
        setMessages((currentMessages) => [...currentMessages, ksefVerificationMessages.confirmed]);
        return;
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        [ksefVerificationMessages.notConfirmed, result.statusCode ? `Status HTTP: ${result.statusCode}.` : "", result.error].filter(Boolean).join(" ")
      ]);
    } catch {
      setMessages((currentMessages) => [
        ...currentMessages,
        "Nie udało się sprawdzić publicznego linku KSeF dla podglądu faktury."
      ]);
    }
  }

  async function translate() {
    if (!invoice) return;
    setIsTranslating(true);
    setMessages([]);
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice, language })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? String(t.translationFailed));
      setInvoice(payload.invoice);
      if (!payload.usedAi) setMessages([String(t.noAi)]);
    } catch (error) {
      setMessages([error instanceof Error ? error.message : String(t.translationFailed)]);
    } finally {
      setIsTranslating(false);
    }
  }

  async function downloadPdf() {
    if (!invoice) return;
    setIsGeneratingPdf(true);
    try {
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice, language, bilingual })
      });
      if (!response.ok) throw new Error(String(t.pdfFailed));
      const ksefConfirmed = response.headers.get("X-KSeF-Verification-Confirmed") === "true";
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ksef-invoice-${invoice.invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      const ksefStatus = response.headers.get("X-KSeF-Verification-Status");
      const ksefError = response.headers.get("X-KSeF-Verification-Error");
      const ksefNumber = response.headers.get("X-KSeF-Number");
      const decodedKsefError = ksefError ? decodeURIComponent(ksefError) : "";
      const decodedKsefNumber = ksefNumber ? decodeURIComponent(ksefNumber) : "";
      if (ksefConfirmed && decodedKsefNumber) {
        setInvoice((currentInvoice) =>
          currentInvoice
            ? {
                ...currentInvoice,
                verification: {
                  ...currentInvoice.verification,
                  ksefNumber: decodedKsefNumber
                }
              }
            : currentInvoice
        );
      }
      setMessages([
        ksefConfirmed
          ? ksefVerificationMessages.confirmed
          : [ksefVerificationMessages.notConfirmed, ksefStatus ? `Status HTTP: ${ksefStatus}.` : "", decodedKsefError].filter(Boolean).join(" ")
      ]);
    } catch (error) {
      setMessages([error instanceof Error ? error.message : String(t.pdfFailed)]);
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-800 shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">KSeF Invoice Translator</p>
              <p className="text-xs text-slate-500">FA(3) XML · PDF · invoice translation</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <a href="#product" className="rounded-md px-3 py-2 hover:bg-slate-100 hover:text-slate-950">{String(t.navProduct)}</a>
            <a href="#how" className="rounded-md px-3 py-2 hover:bg-slate-100 hover:text-slate-950">{String(t.navHow)}</a>
            <a href="#pricing" className="rounded-md px-3 py-2 hover:bg-slate-100 hover:text-slate-950">{String(t.navPricing)}</a>
            <a href="#faq" className="rounded-md px-3 py-2 hover:bg-slate-100 hover:text-slate-950">{String(t.navFaq)}</a>
            <label className="flex items-center gap-2">
              <span className="sr-only">{String(t.uiLanguage)}</span>
              <select
                value={uiLanguage}
                onChange={(event) => setUiLanguage(event.target.value as UiLanguage)}
                className="h-9 rounded-md border border-input bg-white px-2 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="pl">PL</option>
                <option value="en">EN</option>
              </select>
            </label>
            <Link
              href="/login"
              className="ml-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              {uiLanguage === "pl" ? "Zaloguj się" : "Sign in"}
            </Link>
          </nav>
        </div>
      </header>

      <section id="product" className="surface-grid border-b border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-[1fr_470px] md:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-sm font-semibold text-cyan-800 shadow-sm">
              <BadgeCheck className="h-4 w-4" />
              {String(t.badge)}
            </p>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-normal text-slate-950 md:text-6xl">
              {String(t.headline)}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{String(t.subheadline)}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#workspace">
                <Button>
                  <UploadCloud className="h-4 w-4" />
                  {String(t.ctaUpload)}
                </Button>
              </a>
              <a href="#how">
                <Button variant="outline">
                  {String(t.ctaHow)}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
            <div className="mt-8 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
              {[t.trust1, t.trust2, t.trust3].map((item) => (
                <div key={String(item)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 shadow-sm">
                  <Check className="h-4 w-4 text-cyan-700" />
                  {String(item)}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-3">
            <div className="rounded-xl border border-slate-200 bg-slate-950 p-3 text-white shadow-xl">
              <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <p className="text-xs font-medium text-cyan-200">Workspace</p>
                  <p className="text-sm font-semibold">KSeF invoice conversion</p>
                </div>
                <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-200">Ready</div>
              </div>
              <div className="rounded-lg bg-white p-2 text-slate-950">
                <DropZone onFile={handleFile} title={String(t.uploadTitle)} help={String(t.uploadHelp)} compact />
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-200">
                <FeaturePill icon={FileText} label={String(t.parserFeature)} />
                <FeaturePill icon={Languages} label={String(t.translationFeature)} />
                <FeaturePill icon={Download} label={String(t.pdfFeature)} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
                <MiniMetric value="22" label="EU langs" />
                <MiniMetric value="FA(3)" label="schema" />
                <MiniMetric value="QR" label="KSeF link" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workspace" className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold text-slate-950">{String(t.workspaceTitle)}</h2>
          <p className="mt-2 text-slate-600">{String(t.workspaceLead)}</p>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900">
            <ShieldCheck className="h-4 w-4" />
            Data-safe translation scope
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-soft md:flex-row md:items-center md:justify-between">
          <div className="grid gap-2 sm:grid-cols-[220px_auto] sm:items-center">
            <label htmlFor="language" className="text-sm font-medium text-slate-700">
              {String(t.targetLanguage)}
            </label>
            <select
              id="language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as LanguageCode)}
              className="h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {languageOptions.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-medium text-cyan-900">
              <input
                type="checkbox"
                checked={bilingual}
                onChange={(event) => setBilingual(event.target.checked)}
                className="h-4 w-4 rounded border-cyan-300 text-cyan-700 focus:ring-cyan-700"
              />
              {String(t.bilingual)}
            </label>
            <Button onClick={translate} disabled={!invoice || isTranslating} variant="outline">
              {isTranslating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
              {String(t.translate)}
            </Button>
            <Button onClick={downloadPdf} disabled={!invoice || isGeneratingPdf}>
              {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {String(t.download)}
            </Button>
          </div>
        </div>

        {messages.length ? (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
            {messages.map((message) => <p key={message}>{message}</p>)}
          </div>
        ) : null}

        {isParsing ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-600">
            <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-cyan-700" />
            {String(t.parsing)}
          </div>
        ) : invoice ? (
          <InvoicePreview invoice={invoice} language={language} bilingual={bilingual} />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-600">
            <ScanLine className="mx-auto mb-3 h-8 w-8 text-cyan-700" />
            {String(t.empty)} {selectedLanguage}.
          </div>
        )}
      </section>

      <ProcessSection t={t} />
      <ValueSection t={t} />
      <PricingSection t={t} />
      <FaqSection t={t} />

      <section className="border-t border-border bg-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-10 md:px-8">
          <h2 className="text-xl font-semibold text-slate-950">{String(t.seoTitle)}</h2>
          <p className="mt-3 max-w-4xl leading-7 text-slate-600">{String(t.seoBody)}</p>
        </div>
      </section>
    </main>
  );
}

function DropZone({
  onFile,
  title,
  help,
  compact = false
}: {
  onFile: (file?: File) => void;
  title: string;
  help: string;
  compact?: boolean;
}) {
  return (
    <label
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onFile(event.dataTransfer.files[0]);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-center transition-colors hover:border-cyan-700 hover:bg-cyan-50/40 ${compact ? "min-h-48 p-5" : "min-h-56 p-6"}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
        <UploadCloud className="h-6 w-6" />
      </div>
      <span className="mt-4 text-base font-semibold text-slate-950">{title}</span>
      <span className="mt-2 text-sm text-slate-500">{help}</span>
      <input
        type="file"
        accept=".xml,application/xml,text/xml,.pdf,application/pdf"
        className="sr-only"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
    </label>
  );
}

function FeaturePill({ icon: Icon, label }: { icon: typeof FileText; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <Icon className="h-4 w-4 text-cyan-200" />
      <span>{label}</span>
    </div>
  );
}

function MiniMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-2 py-3">
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function ProcessSection({ t }: { t: typeof copy.pl }) {
  return (
    <section id="how" className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-700">Workflow</p>
          <h2 className="text-3xl font-semibold text-slate-950">{String(t.howTitle)}</h2>
          <p className="mt-3 text-slate-600">{String(t.howLead)}</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {(t.steps as string[][]).map(([title, body], index) => (
            <div key={title} className="premium-card rounded-xl p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-700 text-sm font-semibold text-white shadow-sm">{index + 1}</div>
              <h3 className="font-semibold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ValueSection({ t }: { t: typeof copy.pl }) {
  const icons = [ShieldCheck, LockKeyhole, Languages, Building2];
  return (
    <section className="surface-grid bg-slate-50">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-700">Trust model</p>
          <h2 className="text-3xl font-semibold text-slate-950">{String(t.valueTitle)}</h2>
          <p className="mt-3 text-slate-600">{String(t.valueLead)}</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {(t.values as string[][]).map(([title, body], index) => {
            const Icon = icons[index];
            return (
              <div key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PricingSection({ t }: { t: typeof copy.pl }) {
  return (
    <section id="pricing" className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold text-slate-950">{String(t.pricingTitle)}</h2>
          <p className="mt-3 text-slate-600">{String(t.pricingLead)}</p>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {(t.plans as [string, string, string, string[]][]).map(([name, price, lead, features], index) => (
            <div
              key={name}
              className={`rounded-xl border p-6 shadow-soft ${index === 1 ? "border-cyan-300 bg-slate-950 text-white" : "border-slate-200 bg-white"}`}
            >
              <h3 className={`text-lg font-semibold ${index === 1 ? "text-white" : "text-slate-950"}`}>{name}</h3>
              <p className={`mt-3 text-3xl font-semibold ${index === 1 ? "text-white" : "text-slate-950"}`}>{price}</p>
              <p className={`mt-2 text-sm ${index === 1 ? "text-slate-300" : "text-slate-600"}`}>{lead}</p>
              <ul className={`mt-5 space-y-3 text-sm ${index === 1 ? "text-slate-200" : "text-slate-700"}`}>
                {features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${index === 1 ? "text-cyan-200" : "text-cyan-700"}`} />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection({ t }: { t: typeof copy.pl }) {
  return (
    <section id="faq" className="bg-white">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <h2 className="text-3xl font-semibold text-slate-950">{String(t.faqTitle)}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {(t.faqs as string[][]).map(([question, answer]) => (
            <div key={question} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-950">{question}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
