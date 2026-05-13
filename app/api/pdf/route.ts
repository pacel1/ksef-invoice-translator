import { NextResponse } from "next/server";
import { z } from "zod";
import { invoiceSchema } from "@/lib/invoice/schema";
import { verifyPublicKsefQrUrl } from "@/lib/ksef/public-verification";
import { renderInvoicePdfMake } from "@/lib/pdf/invoice-pdfmake";
import { supportedLanguages } from "@/lib/translation/languages";
import { getOrCreateTranslation } from "@/lib/translation/translation-cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Invoice, LanguageCode } from "@/types/invoice";

export const runtime = "nodejs";

const cachedRequestSchema = z.object({
  invoiceId: z.string().uuid(),
  language: z.string(),
  bilingual: z.boolean().optional()
});

const inlineRequestSchema = z.object({
  invoice: z.record(z.unknown()),
  language: z.string(),
  bilingual: z.boolean().optional()
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
  if (!(params.language in supportedLanguages)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const row = await supabase
    .from("invoices")
    .select("source_data")
    .eq("id", params.invoiceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row.data) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const bilingual = params.bilingual !== false;
  const translation = await getOrCreateTranslation({
    supabase: getSupabaseAdminClient(),
    invoice: row.data.source_data as unknown as Invoice,
    invoiceId: params.invoiceId,
    language: params.language as LanguageCode,
    bilingual
  });

  return renderPdfResponse(translation.invoice, params.language as LanguageCode, bilingual);
}

async function pdfFromInline(params: z.infer<typeof inlineRequestSchema>) {
  if (!(params.language in supportedLanguages)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }
  const invoice = invoiceSchema.parse(params.invoice);
  return renderPdfResponse(invoice, params.language as LanguageCode, params.bilingual !== false);
}

async function renderPdfResponse(invoice: Invoice, language: LanguageCode, bilingual: boolean) {
  const verificationUrl = invoice.verification?.qrLink;
  const verificationResult = verificationUrl
    ? await verifyPublicKsefQrUrl(verificationUrl)
    : { confirmed: false as const };
  const invoiceForPdf = invoiceWithConfirmedKsefVerification(invoice, verificationUrl, verificationResult);
  const pdf = await renderInvoicePdfMake(invoiceForPdf, language, bilingual);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(invoice.invoiceNumber)}"`,
      "X-KSeF-Verification-Confirmed": verificationResult.confirmed ? "true" : "false",
      "X-KSeF-Verification-Status": String(verificationResult.statusCode ?? ""),
      "X-KSeF-Verification-Error": encodeHeaderValue(verificationResult.error ?? ""),
      "X-KSeF-Number": encodeHeaderValue(verificationResult.ksefNumber ?? "")
    }
  });
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
    const { verification: _verification, ...invoiceWithoutVerification } = invoice;
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
