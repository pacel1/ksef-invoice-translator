import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  // Ensure the row exists and the monthly free grant has happened before reading.
  const ensure = await admin.rpc("ensure_free_credit_for_period", { p_user: userData.user.id });
  if (ensure.error) {
    console.error("[api/me/balance] ensure failed:", ensure.error);
    return NextResponse.json({ error: "Balance unavailable" }, { status: 500 });
  }

  const balance = await admin
    .from("credit_balances")
    .select("free_credits_remaining, paid_credits, free_credits_period_start")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (balance.error) {
    console.error("[api/me/balance] read failed:", balance.error);
    return NextResponse.json({ error: "Balance unavailable" }, { status: 500 });
  }

  return NextResponse.json({
    freeCreditsRemaining: balance.data?.free_credits_remaining ?? 0,
    paidCredits: balance.data?.paid_credits ?? 0,
    freeCreditsPeriodStart: balance.data?.free_credits_period_start ?? null
  });
}
