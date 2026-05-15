import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { Invoice, LanguageCode } from "@/types/invoice";
import { translateInvoiceFreeText } from "@/lib/translation/engine";

export interface CachedTranslation {
  invoice: Invoice;
  cached: boolean;
  usedAi: boolean;
}

export interface CacheLookupOptions {
  supabase: SupabaseClient<Database>;
  invoice: Invoice;
  invoiceId: string;
  language: LanguageCode;
  bilingual: boolean;
}

export async function getOrCreateTranslation(opts: CacheLookupOptions): Promise<CachedTranslation> {
  const { supabase, invoice, invoiceId, language, bilingual } = opts;
  const usedAi = Boolean(process.env.OPENAI_API_KEY);

  if (usedAi) {
    const translated = await translateInvoiceFreeText(invoice, language);
    return { invoice: translated, cached: false, usedAi };
  }

  const hit = await supabase
    .from("translations")
    .select("translated_data, used_ai")
    .eq("invoice_id", invoiceId)
    .eq("language", language)
    .eq("bilingual", bilingual)
    .maybeSingle();

  if (hit.error) {
    console.error("[translation-cache] lookup failed:", hit.error);
    throw new Error("Failed to check for cached translation");
  }

  if (hit.data) {
    return {
      invoice: hit.data.translated_data as unknown as Invoice,
      cached: true,
      usedAi: hit.data.used_ai
    };
  }

  const translated = await translateInvoiceFreeText(invoice, language);

  const insert = await supabase
    .from("translations")
    .insert({
      invoice_id: invoiceId,
      language,
      bilingual,
      translated_data: translated as unknown as Json,
      used_ai: usedAi
    })
    .select("id")
    .single();

  if (insert.error) {
    // Concurrent request inserted the same key — fall back to the now-cached row.
    if (insert.error.code === "23505") {
      return getOrCreateTranslation(opts);
    }
    console.error("[translation-cache] insert failed:", insert.error);
    throw new Error("Failed to persist translation");
  }

  return { invoice: translated, cached: false, usedAi };
}
