import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { uploadInvoiceForUser, UploadError } from "@/lib/invoice/upload-service";

export const runtime = "nodejs";

/**
 * Single-file upload endpoint. Kept for backward compatibility with
 * anything still posting to /api/upload directly (mobile clients,
 * webhooks, the legacy /app code path that the cutover redirected away
 * from). New code should use POST /api/upload-batch — even with a single
 * file — for consistency with the wizard.
 *
 * Per the Tłumacz redesign cutover (PR #E), this endpoint no longer
 * consumes credit. Credit consumption lives at /api/translate cache-miss.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }

  let result;
  try {
    result = await uploadInvoiceForUser({
      userId: userData.user.id,
      file,
      supabase: admin
    });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[api/upload] unexpected error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  // Credit consumption moved to /api/translate cache-miss in PR #C and made
  // permanent in PR #E. Upload is now free reconnaissance — parsing succeeds
  // before any meter starts.
  return NextResponse.json(result);
}
