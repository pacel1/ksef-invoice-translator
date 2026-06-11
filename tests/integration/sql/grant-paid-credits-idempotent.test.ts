import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function newUser(label: string) {
  const email = `gpc-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  return data.user!.id;
}

describe("grant_paid_credits idempotency", () => {
  it("grants once even if called twice for the same purchase", async () => {
    const userId = await newUser("dbl");
    const { data: pur } = await admin
      .from("stripe_purchases")
      .insert({
        user_id: userId,
        stripe_checkout_session_id: `cs_gpc_${Date.now()}`,
        package_size: 10,
        unit_price_cents: 599,
        total_amount_cents: 5990,
        status: "paid"
      })
      .select("id")
      .single();

    const first = await admin.rpc("grant_paid_credits", { p_user: userId, p_purchase: pur!.id, p_amount: 10 });
    expect(first.error).toBeNull();
    // Second call must be a no-op (DB-level idempotency on stripe_purchase_id),
    // not raise and not double the balance.
    const second = await admin.rpc("grant_paid_credits", { p_user: userId, p_purchase: pur!.id, p_amount: 10 });
    expect(second.error).toBeNull();

    const { data: bal } = await admin.from("credit_balances").select("paid_credits").eq("user_id", userId).single();
    expect(bal?.paid_credits).toBe(10);

    const { data: ledger } = await admin
      .from("credit_ledger")
      .select("event_type")
      .eq("user_id", userId)
      .eq("event_type", "purchase");
    expect(ledger).toHaveLength(1);

    await admin.auth.admin.deleteUser(userId);
  });
});
