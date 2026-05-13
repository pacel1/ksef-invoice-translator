import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { uploadInvoiceForUser, UploadError } from "@/lib/invoice/upload-service";
import {
  InsufficientCreditError,
  assertCreditAvailable,
  consumeCreditForInvoice
} from "@/lib/billing/credit-enforcement";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  // Pre-check: refuse fast (HTTP 402) if the user has zero credits, before parsing.
  try {
    await assertCreditAvailable({ supabase: admin, userId: userData.user.id });
  } catch (error) {
    if (error instanceof InsufficientCreditError) {
      return NextResponse.json(
        { error: "Out of credits", code: "insufficient_credit" },
        { status: 402 }
      );
    }
    console.error("[api/upload] credit pre-check failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

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

  // Only consume a credit for genuinely new invoices. Dedupe hits cost nothing.
  if (result.isNew) {
    try {
      await consumeCreditForInvoice({
        supabase: admin,
        userId: userData.user.id,
        invoiceId: result.invoiceId
      });
    } catch (error) {
      if (error instanceof InsufficientCreditError) {
        // Race: another concurrent upload drained the balance between our pre-check
        // and the consume. Soft-delete the just-inserted row so the user can retry
        // cleanly after topping up.
        await admin
          .from("invoices")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", result.invoiceId);
        return NextResponse.json(
          { error: "Out of credits", code: "insufficient_credit" },
          { status: 402 }
        );
      }
      console.error("[api/upload] credit consumption failed:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  }

  return NextResponse.json(result);
}
