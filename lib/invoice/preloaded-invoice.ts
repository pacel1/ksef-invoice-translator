import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { LanguageCode } from "@/types/invoice";

/**
 * Shape passed from the /translate page to <TranslatorWizardClient> when
 * the user lands via /translate?invoiceId=<uuid>. The client component
 * uses it to hydrate the wizard state into Step 2 or Step 3, skipping
 * the upload flow entirely.
 *
 * Carries only the bits we need for hydration — no source XML, no PDF
 * data. The wizard re-fetches PDF via /api/pdf on demand.
 */
export interface PreloadedInvoice {
  invoiceId: string;
  invoiceNumber: string | null;
  /** Most recent translation, if one exists. Null = jump to Step 2 instead. */
  translation: PreloadedTranslation | null;
}

export interface PreloadedTranslation {
  language: LanguageCode;
  bilingual: boolean;
}

/**
 * Fetch the invoice (verifying user ownership through RLS via the
 * server client) plus the most recent translation row for that invoice,
 * keyed on `created_at` desc.
 *
 * Returns null if the invoice doesn't exist or doesn't belong to the
 * user — the route handles this by ignoring the ?invoiceId param.
 */
export async function loadPreloadedInvoice(
  supabase: SupabaseClient<Database>,
  invoiceId: string
): Promise<PreloadedInvoice | null> {
  const invoiceRow = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (invoiceRow.error || !invoiceRow.data) return null;

  // Most recent translation row for this invoice. Could be any language —
  // we pick the freshest to honor the user's most recent choice.
  const translationRow = await supabase
    .from("translations")
    .select("language, bilingual")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const translation = translationRow.data
    ? {
        language: translationRow.data.language as LanguageCode,
        bilingual: Boolean(translationRow.data.bilingual)
      }
    : null;

  return {
    invoiceId: invoiceRow.data.id,
    invoiceNumber: invoiceRow.data.invoice_number,
    translation
  };
}
