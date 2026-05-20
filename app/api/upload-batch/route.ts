import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { uploadInvoiceForUser, UploadError } from "@/lib/invoice/upload-service";

export const runtime = "nodejs";

/**
 * Multi-file upload endpoint introduced in the Tłumacz redesign (spec §6.4).
 *
 * Differences from /api/upload (single-file):
 *
 *   1. Accepts up to 20 files in one multipart form (returns 413 above that)
 *   2. Returns a per-file result envelope so callers can surface partial
 *      success — broken files don't poison the rest of the batch
 *   3. Does NOT consume credit at upload time. Credit consumption moves
 *      to /api/translate per the design (§6.2). Uploading without ever
 *      translating is now free, which matches user mental model:
 *      "I'm checking that my files parse" should not cost anything.
 *
 * Auth ordering matches /api/upload: 401 returns before the form is even
 * read, so test harnesses can lock that property without needing a
 * session cookie.
 */
const MAX_FILES_PER_BATCH = 20;

interface SuccessResult {
  ok: true;
  fileName: string;
  invoiceId: string;
  invoiceNumber: string;
  warnings: ReadonlyArray<string>;
  isNew: boolean;
  /**
   * Count of OTHER invoices (excluding this one) the user has uploaded
   * with the same invoice_number. > 0 means there's a possible duplicate
   * — the wizard surfaces it as a warning on the file row so the user
   * can double-check before consuming a credit.
   *
   * 0 means either truly unique, or invoice_number couldn't be parsed
   * (in which case we don't speculate).
   */
  otherWithSameNumber: number;
}

interface FailureResult {
  ok: false;
  fileName: string;
  error: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart form data" },
      { status: 400 }
    );
  }

  const files = formData
    .getAll("file")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }
  if (files.length > MAX_FILES_PER_BATCH) {
    return NextResponse.json(
      {
        error: `Too many files (max ${MAX_FILES_PER_BATCH} per batch)`,
        code: "batch_too_large",
        limit: MAX_FILES_PER_BATCH
      },
      { status: 413 }
    );
  }

  const admin = getSupabaseAdminClient();
  const results: Array<SuccessResult | FailureResult> = [];

  for (const file of files) {
    try {
      const result = await uploadInvoiceForUser({
        userId: userData.user.id,
        file,
        supabase: admin
      });

      // Same-invoice-number lookup: for genuinely-new uploads we count
      // other invoices the user has with the same invoice_number. A hit
      // means "you've sent us this number before from a different file"
      // — likely a duplicate, possibly a correction, worth flagging
      // BEFORE the user pays for translation.
      //
      // For isNew=false (content_hash matched) we don't run the lookup
      // — the wizard already shows a 'duplicate' message via the isNew
      // flag, so the extra DB read would be redundant.
      let otherWithSameNumber = 0;
      const number = result.invoice.invoiceNumber;
      if (result.isNew && typeof number === "string" && number.length > 0) {
        const others = await admin
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userData.user.id)
          .eq("invoice_number", number)
          .is("deleted_at", null)
          .neq("id", result.invoiceId);
        otherWithSameNumber = others.count ?? 0;
      }

      results.push({
        ok: true,
        fileName: file.name,
        invoiceId: result.invoiceId,
        invoiceNumber: number ?? "",
        warnings: result.warnings ?? [],
        isNew: result.isNew,
        otherWithSameNumber
      });
    } catch (error) {
      if (error instanceof UploadError) {
        results.push({ ok: false, fileName: file.name, error: error.message });
        continue;
      }
      console.error("[api/upload-batch] unexpected error:", error);
      results.push({
        ok: false,
        fileName: file.name,
        error: "Upload failed"
      });
    }
  }

  return NextResponse.json({ results });
}
