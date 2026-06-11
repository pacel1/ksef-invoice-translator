import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { priceForPackage } from "@/lib/billing/pricing";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const createdUserIds: string[] = [];

beforeAll(async () => {
  const ping = await fetch(`${APP}/`).catch(() => null);
  if (!ping) throw new Error(`Next dev server not reachable at ${APP}.`);
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET missing in .env.test");
  }
});

afterEach(async () => {
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()!;
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

function signStripePayload(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function setupPurchase(): Promise<{ userId: string; purchaseId: string; sessionId: string; size: number }> {
  const email = `webhook-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  const userId = data.user!.id;
  createdUserIds.push(userId);
  const size = 25;
  const quote = priceForPackage(size);
  const sessionId = `cs_test_${Math.random().toString(36).slice(2)}`;
  const { data: row } = await admin
    .from("stripe_purchases")
    .insert({
      user_id: userId,
      stripe_checkout_session_id: sessionId,
      package_size: size,
      unit_price_cents: quote.unitPriceCents,
      total_amount_cents: quote.totalAmountCents,
      status: "pending"
    })
    .select("id")
    .single();
  return { userId, purchaseId: row!.id, sessionId, size };
}

describe("POST /api/stripe/webhook", () => {
  it("rejects requests with no signature header", async () => {
    const res = await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "checkout.session.completed" })
    });
    expect(res.status).toBe(400);
  });

  it("rejects requests with a bad signature", async () => {
    const res = await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
      body: JSON.stringify({ type: "checkout.session.completed" })
    });
    expect(res.status).toBe(400);
  });

  it("flips a pending purchase to paid and grants credits on checkout.session.completed", async () => {
    const { userId, sessionId, size } = await setupPurchase();
    const payload = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          object: "checkout.session",
          payment_status: "paid",
          metadata: { package_size: String(size), user_id: userId }
        }
      }
    });
    const sig = signStripePayload(payload, process.env.STRIPE_WEBHOOK_SECRET!);

    const res = await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: payload
    });
    expect(res.status).toBe(200);

    const { data: row } = await admin
      .from("stripe_purchases")
      .select("status, credits_granted, paid_at")
      .eq("stripe_checkout_session_id", sessionId)
      .single();
    expect(row?.status).toBe("paid");
    expect(row?.credits_granted).toBe(size);
    expect(row?.paid_at).toBeTruthy();

    const { data: bal } = await admin
      .from("credit_balances")
      .select("paid_credits")
      .eq("user_id", userId)
      .single();
    expect(bal?.paid_credits).toBe(size);
  });

  it("flags the purchase for manual review when buyer identity is missing", async () => {
    const { userId, sessionId, size } = await setupPurchase();
    // No customer_details at all — extraction cannot recover a NIP, so the
    // row must be durably flagged for the operator (credits still granted).
    const payload = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          object: "checkout.session",
          payment_status: "paid",
          metadata: { package_size: String(size), user_id: userId }
        }
      }
    });
    const sig = signStripePayload(payload, process.env.STRIPE_WEBHOOK_SECRET!);

    const res = await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: payload
    });
    expect(res.status).toBe(200);

    const { data: row } = await admin
      .from("stripe_purchases")
      .select("status, needs_manual_review")
      .eq("stripe_checkout_session_id", sessionId)
      .single();
    expect(row?.status).toBe("paid");
    expect(row?.needs_manual_review).toBe(true);
  });

  it("persists buyer identity and does not flag complete B2B sessions", async () => {
    const { userId, sessionId, size } = await setupPurchase();
    const payload = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          object: "checkout.session",
          payment_status: "paid",
          amount_total: 15344,
          currency: "pln",
          metadata: { package_size: String(size), user_id: userId },
          customer_details: {
            email: "ksiegowosc@example.test",
            name: "Jan Kowalski",
            business_name: "Testowa Spółka z o.o.",
            tax_ids: [{ type: "pl_nip", value: "5260250274" }],
            address: {
              line1: "ul. Testowa 1",
              line2: null,
              postal_code: "00-001",
              city: "Warszawa",
              country: "PL"
            }
          }
        }
      }
    });
    const sig = signStripePayload(payload, process.env.STRIPE_WEBHOOK_SECRET!);

    const res = await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: payload
    });
    expect(res.status).toBe(200);

    const { data: row } = await admin
      .from("stripe_purchases")
      .select("status, needs_manual_review, buyer_nip, buyer_business_name")
      .eq("stripe_checkout_session_id", sessionId)
      .single();
    expect(row?.status).toBe("paid");
    expect(row?.needs_manual_review).toBe(false);
    expect(row?.buyer_nip).toBe("5260250274");
    expect(row?.buyer_business_name).toBe("Testowa Spółka z o.o.");
  });

  it("flags for manual review when business name fell back to the cardholder name", async () => {
    const { userId, sessionId, size } = await setupPurchase();
    // Valid NIP but Stripe surfaced no business_name — extraction succeeds
    // using the cardholder's personal name, which must NOT silently become
    // the legal company name on the faktura without operator review.
    const payload = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          object: "checkout.session",
          payment_status: "paid",
          amount_total: 15344,
          currency: "pln",
          metadata: { package_size: String(size), user_id: userId },
          customer_details: {
            email: "jan@example.test",
            name: "Jan Kowalski",
            tax_ids: [{ type: "pl_nip", value: "5260250274" }],
            address: {
              line1: "ul. Testowa 1",
              line2: null,
              postal_code: "00-001",
              city: "Warszawa",
              country: "PL"
            }
          }
        }
      }
    });
    const sig = signStripePayload(payload, process.env.STRIPE_WEBHOOK_SECRET!);

    const res = await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: payload
    });
    expect(res.status).toBe(200);

    const { data: row } = await admin
      .from("stripe_purchases")
      .select("status, needs_manual_review, buyer_nip, buyer_business_name")
      .eq("stripe_checkout_session_id", sessionId)
      .single();
    expect(row?.status).toBe("paid");
    expect(row?.needs_manual_review).toBe(true);
    expect(row?.buyer_nip).toBe("5260250274");
    // Identity is still persisted — the fallback name is better than nothing,
    // the flag just makes an operator confirm it before trusting the faktura.
    expect(row?.buyer_business_name).toBe("Jan Kowalski");
  });

  it("leaves the purchase pending when checkout completes with payment still processing", async () => {
    const { userId, sessionId, size } = await setupPurchase();
    // BLIK/P24 flow: the session completes before the payment confirms —
    // payment_status is "unpaid" and credits must NOT be granted yet.
    const payload = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          object: "checkout.session",
          payment_status: "unpaid",
          metadata: { package_size: String(size), user_id: userId }
        }
      }
    });
    const sig = signStripePayload(payload, process.env.STRIPE_WEBHOOK_SECRET!);

    const res = await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: payload
    });
    expect(res.status).toBe(200);

    const { data: row } = await admin
      .from("stripe_purchases")
      .select("status, credits_granted")
      .eq("stripe_checkout_session_id", sessionId)
      .single();
    expect(row?.status).toBe("pending");
    expect(row?.credits_granted).toBe(0);
  });

  it("grants credits when a delayed payment confirms via async_payment_succeeded", async () => {
    const { userId, sessionId, size } = await setupPurchase();
    const payload = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: "checkout.session.async_payment_succeeded",
      data: {
        object: {
          id: sessionId,
          object: "checkout.session",
          payment_status: "paid",
          amount_total: 15344,
          currency: "pln",
          metadata: { package_size: String(size), user_id: userId },
          customer_details: {
            email: "ksiegowosc@example.test",
            name: "Jan Kowalski",
            business_name: "Testowa Spółka z o.o.",
            tax_ids: [{ type: "pl_nip", value: "5260250274" }],
            address: {
              line1: "ul. Testowa 1",
              line2: null,
              postal_code: "00-001",
              city: "Warszawa",
              country: "PL"
            }
          }
        }
      }
    });
    const sig = signStripePayload(payload, process.env.STRIPE_WEBHOOK_SECRET!);

    const res = await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: payload
    });
    expect(res.status).toBe(200);

    const { data: row } = await admin
      .from("stripe_purchases")
      .select("status, credits_granted, needs_manual_review")
      .eq("stripe_checkout_session_id", sessionId)
      .single();
    expect(row?.status).toBe("paid");
    expect(row?.credits_granted).toBe(size);
    expect(row?.needs_manual_review).toBe(false);

    const { data: bal } = await admin
      .from("credit_balances")
      .select("paid_credits")
      .eq("user_id", userId)
      .single();
    expect(bal?.paid_credits).toBe(size);
  });

  it("marks the purchase failed when a delayed payment fails via async_payment_failed", async () => {
    const { userId, sessionId, size } = await setupPurchase();
    const payload = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: "checkout.session.async_payment_failed",
      data: {
        object: {
          id: sessionId,
          object: "checkout.session",
          payment_status: "unpaid",
          metadata: { package_size: String(size), user_id: userId }
        }
      }
    });
    const sig = signStripePayload(payload, process.env.STRIPE_WEBHOOK_SECRET!);

    const res = await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: payload
    });
    expect(res.status).toBe(200);

    const { data: row } = await admin
      .from("stripe_purchases")
      .select("status, credits_granted")
      .eq("stripe_checkout_session_id", sessionId)
      .single();
    expect(row?.status).toBe("failed");
    expect(row?.credits_granted).toBe(0);

    const { data: bal } = await admin
      .from("credit_balances")
      .select("paid_credits")
      .eq("user_id", userId)
      .maybeSingle();
    expect(bal?.paid_credits ?? 0).toBe(0);
  });

  it("is idempotent — replaying the same event does not double-grant", async () => {
    const { userId, sessionId, size } = await setupPurchase();
    const payload = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          object: "checkout.session",
          payment_status: "paid",
          metadata: { package_size: String(size), user_id: userId }
        }
      }
    });
    const sig = signStripePayload(payload, process.env.STRIPE_WEBHOOK_SECRET!);

    await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: payload
    });
    // Replay.
    await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: payload
    });

    const { data: bal } = await admin
      .from("credit_balances")
      .select("paid_credits")
      .eq("user_id", userId)
      .single();
    expect(bal?.paid_credits).toBe(size);
  });
});
