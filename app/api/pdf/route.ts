import { NextResponse } from "next/server";
import { z } from "zod";
import { invoiceSchema } from "@/lib/invoice/schema";
import { verifyPublicKsefQrUrl } from "@/lib/ksef/public-verification";
import { renderOfficialFa3Pdf } from "@/lib/mf-fa3/official-renderer";
import { renderInvoicePdfMake } from "@/lib/pdf/invoice-pdfmake";
import { applyTranslationNoticesToPdf } from "@/lib/pdf/translation-notice-pdf";
import { supportedLanguages } from "@/lib/translation/languages";
import { getOrCreateTranslation } from "@/lib/translation/translation-cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Invoice, LanguageCode } from "@/types/invoice";

export const runtime = "nodejs";

const cachedRequestSchema = z.object({
  invoiceId: z.string().uuid(),
  language: z.string(),
  bilingual: z.boolean().optional(),
  translated: z.boolean().optional(),
  reviewedBy: z.string().optional()
});

const inlineRequestSchema = z.object({
  invoice: z.record(z.unknown()),
  language: z.string(),
  bilingual: z.boolean().optional(),
  translated: z.boolean().optional(),
  sourceXml: z.string().optional(),
  reviewedBy: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const cached = cachedRequestSchema.safeParse(body);
    if (cached.success) {
      return await pdfFromCache(cached.data);
    }

    const inline = inlineRequestSchema.safeParse(body);
    if (inline.success) {
      return await pdfFromInline(inline.data);
    }

    return NextResponse.json({ error: "Provide either { invoiceId } or { invoice }" }, { status: 400 });
  } catch (error) {
    console.error("[api/pdf] failed:", error);
    return NextResponse.json({ error: "PDF generation failed." }, { status: 500 });
  }
}

async function pdfFromCache(params: z.infer<typeof cachedRequestSchema>) {
  const language = normalizedLanguage(params.language);
  if (!language.ok) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const [row, profile] = await Promise.all([
    supabase
    .from("invoices")
    .select("source_data")
    .eq("id", params.invoiceId)
    .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userData.user.id)
      .maybeSingle()
  ]);
  if (!row.data) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const sourceInvoice = invoiceSchema.parse(row.data.source_data);
  const translated = params.translated ?? language.translated;
  const bilingual = translated && params.bilingual !== false;
  const invoice = translated
    ? (
        await getOrCreateTranslation({
          supabase: getSupabaseAdminClient(),
          invoice: sourceInvoice,
          invoiceId: params.invoiceId,
          language: language.code,
          bilingual
        })
      ).invoice
    : sourceInvoice;

  return renderPdfResponse(invoice, language.code, bilingual, translated, {
    sourceXml: invoice.sourceXml ?? sourceInvoice.sourceXml,
    reviewedBy: params.reviewedBy ?? profile.data?.display_name ?? userData.user.email
  });
}

async function pdfFromInline(params: z.infer<typeof inlineRequestSchema>) {
  const language = normalizedLanguage(params.language);
  if (!language.ok) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }
  const invoice = invoiceSchema.parse(params.invoice);
  const translated = params.translated ?? language.translated;
  const bilingual = translated && params.bilingual !== false;
  return renderPdfResponse(invoice, language.code, bilingual, translated, {
    sourceXml: params.sourceXml ?? invoice.sourceXml,
    reviewedBy: params.reviewedBy
  });
}

async function renderPdfResponse(
  invoice: Invoice,
  language: LanguageCode,
  bilingual: boolean,
  translated: boolean,
  options: {
    sourceXml?: string;
    reviewedBy?: string | null;
  }
) {
  const verificationUrl = invoice.verification?.qrLink;
  const verificationResult = verificationUrl
    ? await verifyPublicKsefQrUrl(verificationUrl)
    : { confirmed: false as const };
  const invoiceForPdf = invoiceWithConfirmedKsefVerification(invoice, verificationUrl, verificationResult);
  const rendered = options.sourceXml
    ? await renderPdfWithOfficialFallback(options.sourceXml, invoiceForPdf, language, bilingual, translated)
    : { pdf: await renderInvoicePdfMake(invoiceForPdf, language, bilingual), renderer: "legacy-no-source-xml" };
  const pdf = translated
    ? await applyTranslationNoticesToPdf(rendered.pdf, language, {
        reviewedBy: options.reviewedBy,
        generatedAt: formatGeneratedAt(new Date())
      })
    : rendered.pdf;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(invoice.invoiceNumber)}"`,
      "X-PDF-Renderer": rendered.renderer,
      "X-KSeF-Verification-Confirmed": verificationResult.confirmed ? "true" : "false",
      "X-KSeF-Verification-Status": String(verificationResult.statusCode ?? ""),
      "X-KSeF-Verification-Error": encodeHeaderValue(verificationResult.error ?? ""),
      "X-KSeF-Number": encodeHeaderValue(verificationResult.ksefNumber ?? "")
    }
  });
}

async function renderPdfWithOfficialFallback(
  sourceXml: string,
  invoice: Invoice,
  language: LanguageCode,
  bilingual: boolean,
  translated: boolean
) {
  try {
    return {
      pdf: await renderOfficialFa3Pdf({ sourceXml, invoice, language, bilingual, translated }),
      renderer: "official-mf-fa3"
    };
  } catch (error) {
    console.warn("Official MF FA(3) renderer failed, falling back to custom renderer.", error);
    return {
      pdf: await renderInvoicePdfMake(invoice, language, bilingual),
      renderer: "legacy-official-failed"
    };
  }
}

function normalizedLanguage(language: string):
  { ok: true; code: LanguageCode; translated: boolean } {
  if (language === "pl") return { ok: true, code: "en", translated: false };
  if (language in supportedLanguages) return { ok: true, code: language as LanguageCode, translated: true };
  return { ok: true, code: "en", translated: true };
}

function formatGeneratedAt(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function encodeHeaderValue(value: string) {
  return encodeURIComponent(value).slice(0, 500);
}

function invoiceWithConfirmedKsefVerification(
  invoice: Invoice,
  verificationUrl: string | undefined,
  verificationResult: { confirmed: boolean; ksefNumber?: string }
): Invoice {
  if (!verificationUrl || !verificationResult.confirmed || !verificationResult.ksefNumber) {
    const invoiceWithoutVerification = { ...invoice };
    delete invoiceWithoutVerification.verification;
    return invoiceWithoutVerification;
  }
  return {
    ...invoice,
    verification: {
      qrLink: verificationUrl,
      ksefNumber: verificationResult.ksefNumber
    }
  };
}

function pdfFilename(invoiceNumber: string) {
  const safeInvoiceNumber = invoiceNumber
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `ksef-invoice-${safeInvoiceNumber || "invoice"}.pdf`;
}
