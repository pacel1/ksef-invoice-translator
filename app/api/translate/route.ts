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
  consumeCreditForInvoice,
  refundTranslationCredit
} from "@/lib/billing/credit-enforcement";
import type { Invoice, LanguageCode } from "@/types/invoice";

/**
 * Tłumacz redesign behavior (spec §6.2), made permanent in PR #E:
 *   - Pre-checks credit before translating (fast 402 on dry)
 *   - Consumes exactly one credit per fresh translation (cache hits stay
 *     free — `cacheHit: true` in the response)
 *   - /api/upload no longer consumes credit (the meter lives here)
 *   - Refund on consume failure via refund_translation_credit SQL function
 */

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
  // This endpoint is the metered surface. Pre-check balance BEFORE calling
  // the (potentially slow) translation engine so the user gets a fast 402
  // instead of an OpenAI bill.
  //
  // Consumption happens AFTER getOrCreateTranslation returns — cache hits
  // stay free (response.cacheHit=true), cache misses consume one credit
  // and refund via refund_translation_credit on consume failure.
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

  let result;
  try {
    result = await getOrCreateTranslation({
      supabase: admin,
      invoice: row.data.source_data as unknown as Invoice,
      invoiceId: params.invoiceId,
      language: params.language as LanguageCode,
      bilingual: params.bilingual !== false
    });
  } catch (translationError) {
    // Translation engine failed — under TRANSLATE_V2, no credit has been
    // consumed yet (consume runs only AFTER the engine returns), so no
    // refund needed here.
    console.error("[api/translate] translation engine failed:", translationError);
    return NextResponse.json(
      { error: "Translation failed", code: "translation_failed" },
      { status: 502 }
    );
  }

  // Consume credit on cache-miss only. Cache hits stay free — that's the
  // "Z cache — bez opłaty" badge in the wizard UI.
  if (!result.cached) {
    try {
      await consumeCreditForInvoice({
        supabase: admin,
        userId: userData.user.id,
        invoiceId: params.invoiceId
      });
    } catch (error) {
      if (error instanceof InsufficientCreditError) {
        // Race: balance drained between pre-check and consume. The
        // translation already ran (and was cached); we refund the implicit
        // free use by deleting the translation row would be wrong (someone
        // else might consume it). Just surface the 402 — the work is
        // effectively donated.
        return NextResponse.json(
          { error: "Out of credits", code: "insufficient_credit" },
          { status: 402 }
        );
      }
      console.error("[api/translate] credit consumption failed:", error);

      // Best-effort refund of any partial state — the consume call may have
      // half-completed (insert + update split). The refund function is
      // idempotent so this is safe to call even when nothing was consumed.
      await refundTranslationCredit({
        supabase: admin,
        userId: userData.user.id,
        invoiceId: params.invoiceId
      }).catch((refundError) => {
        console.error("[api/translate] refund attempt failed:", refundError);
      });
      // The translation itself succeeded — return it; we won't double-bill.
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
