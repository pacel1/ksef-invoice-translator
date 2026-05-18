import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface DeleteBody {
  confirmEmail?: string;
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const user = userData.user;

  let body: DeleteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.confirmEmail || typeof body.confirmEmail !== "string") {
    return NextResponse.json({ error: "confirmEmail is required" }, { status: 400 });
  }

  if (body.confirmEmail.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return NextResponse.json(
      { error: "confirmEmail does not match the authenticated user" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("[me/account] delete failed:", deleteError);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
