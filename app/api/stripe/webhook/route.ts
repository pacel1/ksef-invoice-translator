import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/billing/stripe-client";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET missing");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const stripe = getStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (error) {
    console.error("[webhook] signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(admin, session);
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      await handleChargeRefunded(admin, charge);
    }
    // Ignore other event types silently — Stripe will retry only on non-2xx.
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[webhook] handler for ${event.type} failed:`, error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.payment_status !== "paid") return;

  const purchase = await admin
    .from("stripe_purchases")
    .select("id, user_id, package_size, status")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (!purchase.data) {
    console.warn(`[webhook] no stripe_purchases row for session ${session.id}`);
    return;
  }

  // Idempotency: if already paid, do nothing.
  if (purchase.data.status === "paid") {
    return;
  }

  const update = await admin
    .from("stripe_purchases")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      credits_granted: purchase.data.package_size,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null
    })
    .eq("id", purchase.data.id)
    .eq("status", "pending") // Re-check status atomically (extra guard against races).
    .select("id")
    .maybeSingle();

  if (!update.data) {
    // Either someone else flipped it concurrently, or it was already paid.
    return;
  }

  const grant = await admin.rpc("grant_paid_credits", {
    p_user: purchase.data.user_id,
    p_purchase: purchase.data.id,
    p_amount: purchase.data.package_size
  });
  if (grant.error) {
    console.error("[webhook] grant_paid_credits failed:", grant.error);
    throw new Error("grant_paid_credits failed");
  }
}

async function handleChargeRefunded(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  charge: Stripe.Charge
): Promise<void> {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) return;

  const purchase = await admin
    .from("stripe_purchases")
    .select("id, user_id, package_size, status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (!purchase.data) {
    console.warn(`[webhook] no stripe_purchases row for payment_intent ${paymentIntentId}`);
    return;
  }

  if (purchase.data.status === "refunded") {
    return; // Idempotent.
  }

  const update = await admin
    .from("stripe_purchases")
    .update({ status: "refunded" })
    .eq("id", purchase.data.id)
    .neq("status", "refunded")
    .select("id")
    .maybeSingle();

  if (!update.data) return;

  const refund = await admin.rpc("refund_paid_credits", {
    p_user: purchase.data.user_id,
    p_purchase: purchase.data.id,
    p_amount: purchase.data.package_size
  });
  if (refund.error) {
    console.error("[webhook] refund_paid_credits failed:", refund.error);
    throw new Error("refund_paid_credits failed");
  }
}
