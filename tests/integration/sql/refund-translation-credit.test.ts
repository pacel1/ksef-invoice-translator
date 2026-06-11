import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

async function newUser(label: string) {
  const email = `rtc-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  return data.user!.id;
}

describe("refund_translation_credit", () => {
  it("reverses a consumed credit and is idempotent", async () => {
    const userId = await newUser("ok");
    await admin.rpc("ensure_free_credit_for_period", { p_user: userId });

    const { data: inv } = await admin
      .from("invoices")
      .insert({ user_id: userId, source_type: "xml", source_hash: `rtc-${Date.now()}`, source_size: 1, source_data: {} })
      .select()
      .single();

    // Consume the free credit on this invoice.
    const { error: consumeErr } = await admin.rpc("consume_credit", { p_user: userId, p_invoice: inv!.id });
    expect(consumeErr).toBeNull();
    let { data: bal } = await admin.from("credit_balances").select("*").eq("user_id", userId).single();
    expect(bal?.free_credits_remaining).toBe(0);

    // Refund must succeed (this fails today: event_type 'refund_translation' violates the CHECK constraint).
    const { data: refunded, error: refundErr } = await admin.rpc("refund_translation_credit", {
      p_user: userId,
      p_invoice: inv!.id
    });
    expect(refundErr).toBeNull();
    expect(refunded).toBe(true);

    ({ data: bal } = await admin.from("credit_balances").select("*").eq("user_id", userId).single());
    expect(bal?.free_credits_remaining).toBe(1);

    const { data: ledger } = await admin
      .from("credit_ledger")
      .select("event_type, delta_free")
      .eq("user_id", userId)
      .eq("event_type", "refund_translation");
    expect(ledger).toEqual([{ event_type: "refund_translation", delta_free: 1 }]);

    // Second call is a no-op (idempotent) and leaves the balance untouched.
    const { data: secondRefund, error: secondErr } = await admin.rpc("refund_translation_credit", {
      p_user: userId,
      p_invoice: inv!.id
    });
    expect(secondErr).toBeNull();
    expect(secondRefund).toBe(false);

    ({ data: bal } = await admin.from("credit_balances").select("*").eq("user_id", userId).single());
    expect(bal?.free_credits_remaining).toBe(1);

    await admin.auth.admin.deleteUser(userId);
  });

  it("cannot be executed by the anon role", async () => {
    const userId = await newUser("anon");
    const { error } = await anon.rpc("refund_translation_credit", {
      p_user: userId,
      p_invoice: userId // value irrelevant; the call must be rejected before the body runs
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/permission denied|not find the function|Could not/i);
    await admin.auth.admin.deleteUser(userId);
  });
});
