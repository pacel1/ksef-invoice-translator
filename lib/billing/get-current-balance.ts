import { cache } from "react";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export interface CurrentBalance {
  freeCreditsRemaining: number;
  paidCredits: number;
}

/**
 * Server-side helper that fetches the user's current credit balance, ensuring
 * the monthly free grant has been applied first.
 *
 * Wrapped in React `cache()` so that multiple callers within the same request
 * (e.g. the protected layout's <BalanceChip> and the /app page's
 * <LowBalanceBanner>) share a single RPC + select round-trip instead of
 * repeating it for each consumer.
 *
 * Memoization scope is per-request — there is no cross-request caching here,
 * and mutations from this request are immediately visible to subsequent calls
 * (different React renders, different memo keys).
 */
export const getCurrentBalance = cache(async (userId: string): Promise<CurrentBalance> => {
  const admin = getSupabaseAdminClient();
  await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
  const { data } = await admin
    .from("credit_balances")
    .select("free_credits_remaining, paid_credits")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    freeCreditsRemaining: data?.free_credits_remaining ?? 0,
    paidCredits: data?.paid_credits ?? 0
  };
});
