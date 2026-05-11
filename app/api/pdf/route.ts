import { NextResponse } from "next/server";
import { invoiceSchema } from "@/lib/invoice/schema";
import { renderInvoicePdfMake } from "@/lib/pdf/invoice-pdfmake";
import { supportedLanguages } from "@/lib/translation/languages";
import type { LanguageCode } from "@/types/invoice";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const invoice = invoiceSchema.parse(body.invoice);
  const language = body.language as LanguageCode;
  const bilingual = body.bilingual !== false;

  if (!(language in supportedLanguages)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  const pdf = await renderInvoicePdfMake(invoice, language, bilingual);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ksef-invoice-${invoice.invoiceNumber}.pdf"`
    }
  });
}
