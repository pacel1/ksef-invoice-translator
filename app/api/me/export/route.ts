import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface ExportEnvelope {
  generatedAt: string;
  schemaVersion: string;
  profile: unknown;
  balance: unknown;
  invoices: unknown[];
  translations: unknown[];
  purchases: unknown[];
}

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = userData.user.id;
  const admin = getSupabaseAdminClient();

  const [profileRes, balanceRes, invoicesRes, translationsRes, purchasesRes] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).single(),
    admin.from("credit_balances").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("invoices").select("*").eq("user_id", userId).is("deleted_at", null),
    admin
      .from("translations")
      .select("*, invoices!inner(user_id)")
      .eq("invoices.user_id", userId),
    admin.from("stripe_purchases").select("*").eq("user_id", userId)
  ]);

  const envelope: ExportEnvelope = {
    generatedAt: new Date().toISOString(),
    schemaVersion: "1",
    profile: profileRes.data ?? null,
    balance: balanceRes.data ?? null,
    invoices: invoicesRes.data ?? [],
    translations: translationsRes.data ?? [],
    purchases: purchasesRes.data ?? []
  };

  const json = JSON.stringify(envelope, null, 2);
  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="tlumaczksef-export-${userId}-${Date.now()}.json"`
    }
  });
}
