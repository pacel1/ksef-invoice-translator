import { NextResponse } from "next/server";
import { invoiceSchema } from "@/lib/invoice/schema";
import { verifyPublicKsefQrUrl } from "@/lib/ksef/public-verification";
import { renderOfficialFa3Pdf } from "@/lib/mf-fa3/official-renderer";
import { renderInvoicePdfMake } from "@/lib/pdf/invoice-pdfmake";
import { supportedLanguages } from "@/lib/translation/languages";
import type { Invoice, LanguageCode } from "@/types/invoice";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const invoice = invoiceSchema.parse(body.invoice);
    const language = body.language as LanguageCode;
    const translated = body.translated !== false;
    const bilingual = translated && body.bilingual !== false;
    const sourceXml = typeof body.sourceXml === "string" ? body.sourceXml : undefined;

    if (!(language in supportedLanguages)) {
      return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
    }

    const verificationUrl = invoice.verification?.qrLink;
    const verificationResult = verificationUrl
      ? await verifyPublicKsefQrUrl(verificationUrl)
      : { confirmed: false as const };
    const invoiceForPdf = invoiceWithConfirmedKsefVerification(invoice, verificationUrl, verificationResult);
    const pdf = sourceXml
      ? await renderPdfWithOfficialFallback(sourceXml, invoiceForPdf, language, bilingual, translated)
      : await renderInvoicePdfMake(invoiceForPdf, language, bilingual);

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
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF generation failed." },
      { status: 500 }
    );
  }
}

async function renderPdfWithOfficialFallback(
  sourceXml: string,
  invoice: Invoice,
  language: LanguageCode,
  bilingual: boolean,
  translated: boolean
) {
  try {
    return await renderOfficialFa3Pdf({ sourceXml, invoice, language, bilingual, translated });
  } catch (error) {
    console.warn("Official MF FA(3) renderer failed, falling back to custom renderer.", error);
    return renderInvoicePdfMake(invoice, language, bilingual);
  }
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
