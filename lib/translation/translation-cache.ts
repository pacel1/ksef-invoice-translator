import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { Invoice, LanguageCode } from "@/types/invoice";
import { getTranslationEngineVersion, translateInvoiceFreeText } from "@/lib/translation/engine";

export interface CachedTranslation {
  invoice: Invoice;
  cached: boolean;
  usedAi: boolean;
  engineVersion: string;
  timings: TranslationCacheTimings;
}

export interface CacheLookupOptions {
  supabase: SupabaseClient<Database>;
  invoice: Invoice;
  invoiceId: string;
  language: LanguageCode;
  bilingual: boolean;
  engineVersion?: string;
}

export interface TranslationCacheTimings {
  cacheLookupMs?: number;
  aiTranslationMs?: number;
  cacheInsertMs?: number;
  cacheRaceLookupMs?: number;
}

export async function getOrCreateTranslation(opts: CacheLookupOptions): Promise<CachedTranslation> {
  const { supabase, invoice, invoiceId, language, bilingual } = opts;
  const usedAi = Boolean(process.env.OPENAI_API_KEY);
  const engineVersion = opts.engineVersion ?? (usedAi ? getTranslationEngineVersion() : "passthrough-v1");
  const timings: TranslationCacheTimings = {};

  const lookupStarted = performance.now();
  const hit = await supabase
    .from("translations")
    .select("translated_data, used_ai")
    .eq("invoice_id", invoiceId)
    .eq("language", language)
    .eq("bilingual", bilingual)
    .eq("engine_version", engineVersion)
    .maybeSingle();
  timings.cacheLookupMs = elapsedMs(lookupStarted);

  if (hit.error) {
    console.error("[translation-cache] lookup failed:", hit.error);
    throw new Error("Failed to check for cached translation");
  }

  if (hit.data) {
    return {
      invoice: hit.data.translated_data as unknown as Invoice,
      cached: true,
      usedAi: hit.data.used_ai,
      engineVersion,
      timings
    };
  }

  const translationStarted = performance.now();
  const translated = await translateInvoiceFreeText(invoice, language);
  timings.aiTranslationMs = elapsedMs(translationStarted);

  const insertStarted = performance.now();
  const insert = await supabase
    .from("translations")
    .insert({
      invoice_id: invoiceId,
      language,
      bilingual,
      engine_version: engineVersion,
      translated_data: translated as unknown as Json,
      used_ai: usedAi
    })
    .select("id")
    .single();
  timings.cacheInsertMs = elapsedMs(insertStarted);

  if (insert.error) {
    // Concurrent request inserted the same key - fall back to the now-cached row.
    if (insert.error.code === "23505") {
      const raceLookupStarted = performance.now();
      const raceHit = await supabase
        .from("translations")
        .select("translated_data, used_ai")
        .eq("invoice_id", invoiceId)
        .eq("language", language)
        .eq("bilingual", bilingual)
        .eq("engine_version", engineVersion)
        .maybeSingle();
      timings.cacheRaceLookupMs = elapsedMs(raceLookupStarted);

      if (raceHit.error || !raceHit.data) {
        if (raceHit.error) console.error("[translation-cache] race lookup failed:", raceHit.error);
        throw new Error("Failed to read concurrently cached translation");
      }

      return {
        invoice: raceHit.data.translated_data as unknown as Invoice,
        cached: true,
        usedAi: raceHit.data.used_ai,
        engineVersion,
        timings
      };
    }
    console.error("[translation-cache] insert failed:", insert.error);
    throw new Error("Failed to persist translation");
  }

  return { invoice: translated, cached: false, usedAi, engineVersion, timings };
}

function elapsedMs(started: number) {
  return Math.round(performance.now() - started);
}
