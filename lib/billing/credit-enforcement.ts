import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export class InsufficientCreditError extends Error {
  constructor(message = "insufficient_credit") {
    super(message);
    this.name = "InsufficientCreditError";
  }
}

export interface CreditCheckOptions {
  supabase: SupabaseClient<Database>;
  userId: string;
}

export interface CreditConsumeOptions {
  supabase: SupabaseClient<Database>;
  userId: string;
  invoiceId: string;
}

/**
 * Ensures the monthly free credit has been granted for the current period,
 * then verifies the user has at least one credit (free or paid). Throws
 * InsufficientCreditError if the balance is zero. Otherwise resolves silently.
 *
 * Side effect: may insert/refresh the `credit_balances` row via
 * `ensure_free_credit_for_period`. Safe to call on every upload attempt.
 */
export async function assertCreditAvailable({ supabase, userId }: CreditCheckOptions): Promise<void> {
  const ensure = await supabase.rpc("ensure_free_credit_for_period", { p_user: userId });
  if (ensure.error) {
    console.error("[credit] ensure_free_credit_for_period failed:", ensure.error);
    throw new Error("Failed to verify credit balance");
  }

  const balance = await supabase
    .from("credit_balances")
    .select("free_credits_remaining, paid_credits")
    .eq("user_id", userId)
    .maybeSingle();

  if (balance.error) {
    console.error("[credit] balance lookup failed:", balance.error);
    throw new Error("Failed to verify credit balance");
  }

  const total = (balance.data?.free_credits_remaining ?? 0) + (balance.data?.paid_credits ?? 0);
  if (total <= 0) {
    throw new InsufficientCreditError();
  }
}

/**
 * Consumes one credit (free-first, then paid) for the given invoice. Atomic at
 * the SQL function level. Throws InsufficientCreditError when the underlying
 * SQL function raises `insufficient_credit`.
 */
export async function consumeCreditForInvoice({
  supabase,
  userId,
  invoiceId
}: CreditConsumeOptions): Promise<void> {
  const result = await supabase.rpc("consume_credit", {
    p_user: userId,
    p_invoice: invoiceId
  });

  if (result.error) {
    if (result.error.message?.includes("insufficient_credit")) {
      throw new InsufficientCreditError();
    }
    console.error("[credit] consume_credit failed:", result.error);
    throw new Error("Failed to consume credit");
  }
}
