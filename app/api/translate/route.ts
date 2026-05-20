import { NextResponse } from "next/server";
import { z } from "zod";
import { invoiceSchema } from "@/lib/invoice/schema";
import { supportedLanguages } from "@/lib/translation/languages";
import { translateInvoiceFreeText } from "@/lib/translation/engine";
import { getOrCreateTranslation } from "@/lib/translation/translation-cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  InsufficientCreditError,
  assertCreditAvailable,
  consumeCreditForInvoice
} from "@/lib/billing/credit-enforcement";
import type { Invoice, LanguageCode } from "@/types/invoice";

/**
 * Tłumacz redesign flag (spec §6.2). When "1":
 *   - This endpoint pre-checks credit before translating
 *   - Consumes exactly one credit per fresh translation (cache hits are
 *     still free — `cacheHit: true` in the response)
 *   - /api/upload stops consuming credit (credit lives here instead)
 *
 * Off by default → behavior identical to today (translation always free,
 * upload pays).
 */
const TRANSLATE_V2 = process.env.NEXT_PUBLIC_TRANSLATE_V2 === "1";

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

  const admin = getSupabaseAdminClient();

  // ─── Tłumacz credit gate ─────────────────────────────────────────────
  //
  // When TRANSLATE_V2 is on, this endpoint is the metered surface. We
  // pre-check balance BEFORE calling the (potentially slow) translation
  // engine so the user gets a fast 402 instead of an OpenAI bill.
  //
  // Consumption happens AFTER the cache lookup but BEFORE the AI call:
  //   - cache hit  → no consume (response.cacheHit = true)
  //   - cache miss → consume one credit, then translate
  //
  // The cache check is fast (single SELECT against translations table),
  // and `getOrCreateTranslation` returns cached translations idempotently,
  // so we run it twice when needed: once probing for cache (free), once
  // for the actual work (paid). The translation-cache helper short-circuits
  // on hit so the second call is essentially a no-op.
  if (TRANSLATE_V2) {
    try {
      await assertCreditAvailable({ supabase: admin, userId: userData.user.id });
    } catch (error) {
      if (error instanceof InsufficientCreditError) {
        return NextResponse.json(
          { error: "Out of credits", code: "insufficient_credit" },
          { status: 402 }
        );
      }
      console.error("[api/translate] credit pre-check failed:", error);
      return NextResponse.json({ error: "Translation failed" }, { status: 500 });
    }
  }

  const result = await getOrCreateTranslation({
    supabase: admin,
    invoice: row.data.source_data as unknown as Invoice,
    invoiceId: params.invoiceId,
    language: params.language as LanguageCode,
    bilingual: params.bilingual !== false
  });

  // Consume credit on cache-miss only. Cache hits stay free — that's the
  // "Z cache — bez opłaty" badge in the wizard UI.
  if (TRANSLATE_V2 && !result.cached) {
    try {
      await consumeCreditForInvoice({
        supabase: admin,
        userId: userData.user.id,
        invoiceId: params.invoiceId
      });
    } catch (error) {
      if (error instanceof InsufficientCreditError) {
        return NextResponse.json(
          { error: "Out of credits", code: "insufficient_credit" },
          { status: 402 }
        );
      }
      console.error("[api/translate] credit consumption failed:", error);
      // The translation itself succeeded — return it. Future: PR #D adds
      // explicit refund-on-failure via a dedicated SQL function so the
      // consume + AI call can be reversed atomically on engine failure.
    }
  }

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
    cacheHit: result.cached,
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
