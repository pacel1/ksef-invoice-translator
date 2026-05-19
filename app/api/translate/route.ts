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
  const timings: Record<string, number | string | boolean> = {};
  const routeStarted = performance.now();
  if (!(params.language in supportedLanguages)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const authStarted = performance.now();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  timings.authMs = elapsedMs(authStarted);
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const invoiceFetchStarted = performance.now();
  const row = await supabase
    .from("invoices")
    .select("source_data")
    .eq("id", params.invoiceId)
    .is("deleted_at", null)
    .maybeSingle();
  timings.invoiceFetchMs = elapsedMs(invoiceFetchStarted);

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
  Object.assign(timings, result.timings, {
    cached: result.cached,
    usedAi: result.usedAi,
    engineVersion: result.engineVersion,
    totalMs: elapsedMs(routeStarted)
  });
  console.info("[api/translate] timings", timings);

  return NextResponse.json({
    invoice: result.invoice,
    cached: result.cached,
    usedAi: result.usedAi
  });
}

async function translateInline(params: z.infer<typeof inlineRequestSchema>) {
  const routeStarted = performance.now();
  if (!(params.language in supportedLanguages)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }
  const invoice = invoiceSchema.parse(params.invoice);
  const usedAi = Boolean(process.env.OPENAI_API_KEY);
  const translated = await translateInvoiceFreeText(invoice, params.language as LanguageCode);
  console.info("[api/translate] inline timings", {
    usedAi,
    totalMs: elapsedMs(routeStarted)
  });
  return NextResponse.json({ invoice: translated, cached: false, usedAi });
}

function elapsedMs(started: number) {
  return Math.round(performance.now() - started);
}
