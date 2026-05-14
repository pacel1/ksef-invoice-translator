import { describe, it, expect, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  InsufficientCreditError,
  assertCreditAvailable,
  consumeCreditForInvoice
} from "@/lib/billing/credit-enforcement";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const createdUserIds: string[] = [];

async function newUser(label: string) {
  const email = `credit-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  const id = data.user!.id;
  createdUserIds.push(id);
  return id;
}

async function newInvoice(userId: string) {
  const { data } = await admin
    .from("invoices")
    .insert({
      user_id: userId,
      source_type: "xml",
      source_hash: `h-${Date.now()}-${Math.random()}`,
      source_size: 1,
      source_data: {}
    })
    .select("id")
    .single();
  return data!.id;
}

afterEach(async () => {
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()!;
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe("assertCreditAvailable", () => {
  it("allows a brand-new user (free credit auto-granted)", async () => {
    const userId = await newUser("fresh");
    await expect(assertCreditAvailable({ supabase: admin, userId })).resolves.toBeUndefined();
  });

  it("throws InsufficientCreditError when both balances are zero", async () => {
    const userId = await newUser("drained");
    // Ensure the row exists with the initial free grant.
    await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
    // Drain it directly to simulate a user who has consumed their free credit.
    await admin
      .from("credit_balances")
      .update({ free_credits_remaining: 0, paid_credits: 0 })
      .eq("user_id", userId);

    await expect(assertCreditAvailable({ supabase: admin, userId })).rejects.toBeInstanceOf(
      InsufficientCreditError
    );
  });

  it("allows when paid_credits > 0 even if free is zero", async () => {
    const userId = await newUser("paid-only");
    await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
    await admin
      .from("credit_balances")
      .update({ free_credits_remaining: 0, paid_credits: 5 })
      .eq("user_id", userId);

    await expect(assertCreditAvailable({ supabase: admin, userId })).resolves.toBeUndefined();
  });
});

describe("consumeCreditForInvoice", () => {
  it("decrements free credits and inserts a ledger entry", async () => {
    const userId = await newUser("consume");
    const invoiceId = await newInvoice(userId);

    await consumeCreditForInvoice({ supabase: admin, userId, invoiceId });

    const { data: bal } = await admin
      .from("credit_balances")
      .select("free_credits_remaining, paid_credits")
      .eq("user_id", userId)
      .single();
    expect(bal).toMatchObject({ free_credits_remaining: 0, paid_credits: 0 });

    const { data: ledger } = await admin
      .from("credit_ledger")
      .select("event_type, delta_free, invoice_id")
      .eq("user_id", userId)
      .eq("event_type", "consume");
    expect(ledger).toEqual([
      { event_type: "consume", delta_free: -1, invoice_id: invoiceId }
    ]);
  });

  it("throws InsufficientCreditError when nothing is left to consume", async () => {
    const userId = await newUser("consume-empty");
    const invoiceId = await newInvoice(userId);
    await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
    await admin
      .from("credit_balances")
      .update({ free_credits_remaining: 0, paid_credits: 0 })
      .eq("user_id", userId);

    await expect(
      consumeCreditForInvoice({ supabase: admin, userId, invoiceId })
    ).rejects.toBeInstanceOf(InsufficientCreditError);
  });
});
