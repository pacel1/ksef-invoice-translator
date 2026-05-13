import { NextResponse } from "next/server";
import { z } from "zod";
import { invoiceSchema } from "@/lib/invoice/schema";
import { supportedLanguages } from "@/lib/translation/languages";
import { translateInvoiceFreeText } from "@/lib/translation/engine";
import { getOrCreateTranslation } from "@/lib/translation/translation-cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Invoice, LanguageCode } from "@/types/invoice";

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
  const body = await request.json().catch(() => ({}));

  const cached = cachedRequestSchema.safeParse(body);
  if (cached.success) {
    return translateCached(cached.data);
  }

  const inline = inlineRequestSchema.safeParse(body);
  if (inline.success) {
    return translateInline(inline.data);
  }

  return NextResponse.json({ error: "Provide either { invoiceId } or { invoice }" }, { status: 400 });
}

async function translateCached(params: z.infer<typeof cachedRequestSchema>) {
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

  const result = await getOrCreateTranslation({
    supabase: getSupabaseAdminClient(),
    invoice: row.data.source_data as unknown as Invoice,
    invoiceId: params.invoiceId,
    language: params.language as LanguageCode,
    bilingual: params.bilingual !== false
  });

  return NextResponse.json({
    invoice: result.invoice,
    cached: result.cached,
    usedAi: result.usedAi
  });
}

async function translateInline(params: z.infer<typeof inlineRequestSchema>) {
  if (!(params.language in supportedLanguages)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }
  const invoice = invoiceSchema.parse(params.invoice);
  const usedAi = Boolean(process.env.OPENAI_API_KEY);
  const translated = await translateInvoiceFreeText(invoice, params.language as LanguageCode);
  return NextResponse.json({ invoice: translated, cached: false, usedAi });
}
