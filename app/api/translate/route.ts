import { NextResponse } from "next/server";
import { invoiceSchema } from "@/lib/invoice/schema";
import { supportedLanguages } from "@/lib/translation/languages";
import { translateInvoiceFreeText } from "@/lib/translation/engine";
import type { LanguageCode } from "@/types/invoice";

export async function POST(request: Request) {
  const body = await request.json();
  const invoice = invoiceSchema.parse(body.invoice);
  const language = body.language as LanguageCode;

  if (!(language in supportedLanguages)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  const usedAi = Boolean(process.env.OPENAI_API_KEY);
  const translated = await translateInvoiceFreeText(invoice, language);
  return NextResponse.json({ invoice: translated, usedAi });
}
