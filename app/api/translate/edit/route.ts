import { NextResponse } from "next/server";
import { z } from "zod";
import { invoiceSchema } from "@/lib/invoice/schema";
import { supportedLanguages } from "@/lib/translation/languages";
import { applyTranslationEdits } from "@/lib/translation/apply-edits";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Invoice } from "@/types/invoice";

export const runtime = "nodejs";

/**
 * POST /api/translate/edit — overlay user edits on a cached translation.
 *
 * The wizard's <TranslationEditor> calls this when the user clicks Save
 * after editing free-text fields (item names, item units, notes, footer).
 * Edits never consume credit — they're corrections, not translations.
 *
 * Idempotent: editing the same field twice is fine; the JSON gets the
 * latest value either way. Safe to retry on transient errors.
 */
const itemEditSchema = z.object({
  index: z.number().int().min(0),
  translatedName: z.union([z.string(), z.null()]).optional(),
  translatedUnit: z.union([z.string(), z.null()]).optional()
});

const editsSchema = z.object({
  items: z.array(itemEditSchema).optional(),
  translatedNotes: z.union([z.string(), z.null()]).optional(),
  footerText: z.union([z.string(), z.null()]).optional()
});

const requestSchema = z.object({
  invoiceId: z.string().uuid(),
  language: z.string(),
  bilingual: z.boolean().optional(),
  edits: editsSchema
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { invoiceId, language, bilingual = true, edits } = parsed.data;
  if (!(language in supportedLanguages)) {
    return NextResponse.json(
      { error: "Unsupported language" },
      { status: 400 }
    );
  }

  // Ownership check — RLS already filters to user-owned rows, but the
  // explicit lookup gives us a clean 404 if the invoice is missing or
  // owned by someone else.
  const invoiceRow = await supabase
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (invoiceRow.error || !invoiceRow.data) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Load the cached translation row to edit. We use the admin client
  // because translations.translated_data is large and we want to skip
  // RLS round-trips during the read-modify-write.
  const admin = getSupabaseAdminClient();
  const translationRow = await admin
    .from("translations")
    .select("translated_data")
    .eq("invoice_id", invoiceId)
    .eq("language", language)
    .eq("bilingual", bilingual)
    .maybeSingle();
  if (translationRow.error || !translationRow.data) {
    return NextResponse.json(
      { error: "Translation not found — translate the invoice first" },
      { status: 404 }
    );
  }

  let currentInvoice: Invoice;
  try {
    currentInvoice = invoiceSchema.parse(translationRow.data.translated_data);
  } catch (parseError) {
    console.error("[api/translate/edit] failed to parse cached translation:", parseError);
    return NextResponse.json(
      { error: "Stored translation is corrupted" },
      { status: 500 }
    );
  }

  const updated = applyTranslationEdits(currentInvoice, edits);

  const updateResult = await admin
    .from("translations")
    .update({ translated_data: updated as never })
    .eq("invoice_id", invoiceId)
    .eq("language", language)
    .eq("bilingual", bilingual);
  if (updateResult.error) {
    console.error("[api/translate/edit] update failed:", updateResult.error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, invoice: updated });
}
