import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function newUser(label: string) {
  const email = `cf-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  // No credit_balances pre-insert — the SQL functions own creation of that row so we exercise the real path.
  return data.user!.id;
}

describe("credit functions", () => {
  it("ensure_free_credit_for_period grants 1 once per month", async () => {
    const userId = await newUser("free");
    await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
    let { data: bal } = await admin.from("credit_balances").select("*").eq("user_id", userId).single();
    expect(bal?.free_credits_remaining).toBe(1);

    await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
    ({ data: bal } = await admin.from("credit_balances").select("*").eq("user_id", userId).single());
    expect(bal?.free_credits_remaining).toBe(1);

    await admin.auth.admin.deleteUser(userId);
  });

  it("consume_credit prefers free, then paid, raises on zero", async () => {
    const userId = await newUser("consume");
    await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
    await admin.from("credit_balances").update({ paid_credits: 2 }).eq("user_id", userId);

    const { data: inv1 } = await admin
      .from("invoices")
      .insert({ user_id: userId, source_type: "xml", source_hash: "h1", source_size: 1, source_data: {} })
      .select()
      .single();
    const { error: e1 } = await admin.rpc("consume_credit", { p_user: userId, p_invoice: inv1!.id });
    expect(e1).toBeNull();

    let { data: bal } = await admin.from("credit_balances").select("*").eq("user_id", userId).single();
    expect(bal).toMatchObject({ free_credits_remaining: 0, paid_credits: 2 });

    for (let i = 0; i < 2; i++) {
      const { data: inv } = await admin
        .from("invoices")
        .insert({ user_id: userId, source_type: "xml", source_hash: `p${i}`, source_size: 1, source_data: {} })
        .select()
        .single();
      await admin.rpc("consume_credit", { p_user: userId, p_invoice: inv!.id });
    }

    ({ data: bal } = await admin.from("credit_balances").select("*").eq("user_id", userId).single());
    expect(bal).toMatchObject({ free_credits_remaining: 0, paid_credits: 0 });

    const { data: inv4 } = await admin
      .from("invoices")
      .insert({ user_id: userId, source_type: "xml", source_hash: "p3", source_size: 1, source_data: {} })
      .select()
      .single();
    const { error: outOfCredits } = await admin.rpc("consume_credit", { p_user: userId, p_invoice: inv4!.id });
    expect(outOfCredits?.message ?? "").toMatch(/insufficient_credit/);

    await admin.auth.admin.deleteUser(userId);
  });

  it("grant_paid_credits increments and logs", async () => {
    const userId = await newUser("grant");
    const { data: pur } = await admin
      .from("stripe_purchases")
      .insert({
        user_id: userId,
        stripe_checkout_session_id: `cs_${Date.now()}`,
        package_size: 10,
        unit_price_cents: 599,
        total_amount_cents: 5990,
        status: "paid"
      })
      .select()
      .single();

    await admin.rpc("grant_paid_credits", { p_user: userId, p_purchase: pur!.id, p_amount: 10 });

    const { data: bal } = await admin.from("credit_balances").select("*").eq("user_id", userId).single();
    expect(bal?.paid_credits).toBe(10);

    const { data: ledger } = await admin
      .from("credit_ledger")
      .select("event_type, delta_paid")
      .eq("user_id", userId)
      .eq("event_type", "purchase");
    expect(ledger).toEqual([{ event_type: "purchase", delta_paid: 10 }]);

    await admin.auth.admin.deleteUser(userId);
  });
});
