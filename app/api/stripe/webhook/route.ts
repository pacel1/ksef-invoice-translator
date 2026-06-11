import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/billing/stripe-client";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildIfirmaFaktura } from "@/lib/billing/build-ifirma-faktura";
import { issueFaktura, sendToKsef } from "@/lib/billing/ifirma";
import { sendPaymentConfirmationEmail } from "@/lib/billing/payment-confirmation-email";
import { createResendSendFn } from "@/lib/email/resend-sender";

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

  // Mode separation: once STRIPE_LIVE is flipped on for the production cutover,
  // refuse test-mode events. They are forgeable with a Stripe test card, so a
  // test webhook endpoint ever pointed at prod (or a secret mix-up) must not be
  // able to grant real credits. Ack with 200 so Stripe does not retry.
  if (process.env.STRIPE_LIVE === "true" && event.livemode !== true) {
    console.error(`[webhook] ignoring non-livemode event ${event.id} while STRIPE_LIVE=true`);
    return NextResponse.json({ received: true, ignored: "test-mode event in live mode" });
  }

  const admin = getSupabaseAdminClient();

  try {
    if (
      event.type === "checkout.session.completed" ||
      // Delayed-confirmation methods (BLIK, P24): the session completes
      // with payment_status "unpaid" and this event delivers the actual
      // confirmation later. Same handler — it only acts on "paid" and the
      // pending→paid flip keeps it idempotent across both events.
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(admin, session);
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleAsyncPaymentFailed(admin, session);
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

interface BuyerIdentity {
  buyer_nip: string;
  buyer_eu_vat: string | null;
  buyer_business_name: string;
  buyer_email: string;
  buyer_address_line1: string | null;
  buyer_address_line2: string | null;
  buyer_postal_code: string | null;
  buyer_city: string | null;
  buyer_country: string | null;
}

class MissingBuyerIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingBuyerIdentityError";
  }
}

interface ExtractedBuyer {
  identity: BuyerIdentity;
  /**
   * Where the business name came from. "cardholder_name" means Stripe
   * surfaced no business_name and we fell back to the cardholder's
   * personal name — usable, but it must not silently become the legal
   * company name on the faktura, so the purchase gets flagged for review.
   */
  businessNameSource: "business_name" | "cardholder_name";
}

/**
 * Extract buyer identity from a checkout.session.completed event. Throws
 * if the required B2B fields are missing — the checkout config makes them
 * mandatory, so a missing field signals a misconfiguration on the Stripe
 * side and we should fail loudly rather than silently issue a wrong faktura.
 */
function extractBuyerIdentity(session: Stripe.Checkout.Session): ExtractedBuyer {
  const details = session.customer_details;
  if (!details) {
    throw new MissingBuyerIdentityError("customer_details missing on session");
  }

  // Stripe stores tax IDs as an array; we expect exactly one for B2B.
  const taxIds = details.tax_ids ?? [];
  const taxId = taxIds[0];
  if (!taxId || !taxId.value) {
    throw new MissingBuyerIdentityError("no tax_id on customer_details");
  }

  // Map Stripe's tax-id types onto our two-column model:
  //   pl_nip → buyer_nip (raw 10 digits)
  //   eu_vat starting with PL → buyer_nip (after stripping PL prefix) + buyer_eu_vat
  //   eu_vat starting with anything else → buyer_eu_vat only (we'd reject this
  //     before reaching production since the checkout is PL-NIP-only by policy)
  let buyer_nip: string;
  let buyer_eu_vat: string | null = null;
  if (taxId.type === "pl_nip") {
    buyer_nip = taxId.value;
  } else if (taxId.type === "eu_vat" && taxId.value.toUpperCase().startsWith("PL")) {
    buyer_nip = taxId.value.slice(2);
    buyer_eu_vat = taxId.value;
  } else {
    throw new MissingBuyerIdentityError(
      `non-PL tax_id (${taxId.type}: ${taxId.value}) — checkout policy requires PL NIP`
    );
  }

  // Stripe Tax-ID UI captures `business_name` as a separate field, and
  // `name` is the cardholder name. For B2B we want the company name first
  // and fall back to `name` only if Stripe didn't surface a business_name
  // (older Stripe accounts that don't enable the legal-name capture).
  const businessName = details.business_name ?? details.name ?? null;
  if (!businessName) {
    throw new MissingBuyerIdentityError("buyer business name missing");
  }
  if (!details.email) {
    throw new MissingBuyerIdentityError("buyer email missing");
  }

  const address = details.address ?? null;

  return {
    identity: {
      buyer_nip,
      buyer_eu_vat,
      buyer_business_name: businessName,
      buyer_email: details.email,
      buyer_address_line1: address?.line1 ?? null,
      buyer_address_line2: address?.line2 ?? null,
      buyer_postal_code: address?.postal_code ?? null,
      buyer_city: address?.city ?? null,
      buyer_country: address?.country ?? null
    },
    businessNameSource: details.business_name ? "business_name" : "cardholder_name"
  };
}

async function handleCheckoutCompleted(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.payment_status !== "paid") return;

  const purchase = await admin
    .from("stripe_purchases")
    .select("id, user_id, package_size, status, total_amount_cents, currency")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (!purchase.data) {
    console.warn(`[webhook] no stripe_purchases row for session ${session.id}`);
    return;
  }

  if (purchase.data.status === "paid") {
    return; // Idempotent — already processed.
  }

  // Verify the customer actually paid what we quoted before granting. Credits
  // are driven by the server-stored package_size, so this is the defense layer
  // that catches an underpayment introduced by a future coupon/partial-capture
  // flow or a price-tier regression. Stripe always sends amount_subtotal (the
  // pre-tax line total, which equals our net total_amount_cents — VAT is added
  // on top via the static tax rate) and currency on a completed session; when
  // present they must match, with no discount applied. On mismatch we flag the
  // row for an operator and do NOT grant.
  if (session.amount_subtotal != null) {
    const discount = session.total_details?.amount_discount ?? 0;
    const currencyOk =
      (session.currency ?? "").toLowerCase() === (purchase.data.currency ?? "pln").toLowerCase();
    const amountOk =
      session.amount_subtotal === purchase.data.total_amount_cents && discount === 0 && currencyOk;
    if (!amountOk) {
      console.error(
        `[webhook] amount mismatch on session ${session.id}: subtotal=${session.amount_subtotal} ` +
          `expected=${purchase.data.total_amount_cents} discount=${discount} currency=${session.currency} ` +
          `— flagging for review, not granting`
      );
      await admin
        .from("stripe_purchases")
        .update({ needs_manual_review: true })
        .eq("id", purchase.data.id)
        .eq("status", "pending");
      return;
    }
  }

  // Extract buyer identity BEFORE granting credits. If extraction fails we
  // flag the row for manual review; the operator can backfill from Stripe
  // later. We still grant credits because the customer paid; the
  // missing-data state is a tax-compliance problem, not a fulfillment one.
  let extracted: ExtractedBuyer | null = null;
  try {
    extracted = extractBuyerIdentity(session);
  } catch (error) {
    if (error instanceof MissingBuyerIdentityError) {
      console.error(
        `[webhook] missing buyer identity on session ${session.id}:`,
        error.message
      );
    } else {
      throw error;
    }
  }
  const buyerIdentity = extracted?.identity ?? null;

  if (extracted?.businessNameSource === "cardholder_name") {
    console.warn(
      `[webhook] business name fell back to cardholder name on session ${session.id} — flagging for review`
    );
  }

  // Atomic status flip + identity persistence in one update. A purchase
  // without buyer identity — or with a business name that fell back to
  // the cardholder's personal name — is durably flagged so it shows up
  // in queries, not just in webhook logs: the faktura needs an operator
  // to backfill or verify the legal company name.
  const update = await admin
    .from("stripe_purchases")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      credits_granted: purchase.data.package_size,
      needs_manual_review:
        extracted === null || extracted.businessNameSource === "cardholder_name",
      stripe_payment_intent_id:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,
      ...(buyerIdentity ?? {})
    })
    .eq("id", purchase.data.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!update.data) {
    return; // Concurrent webhook won the race; already processed.
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

  await trySendPaymentConfirmationEmail(admin, session, {
    userId: purchase.data.user_id,
    packageSize: purchase.data.package_size,
    buyerEmail:
      buyerIdentity?.buyer_email ??
      session.customer_details?.email ??
      session.customer_email ??
      null
  });

  // Only create the ksef_invoices row if we have the buyer identity. Without
  // it the cron would just fail to build params and retry forever.
  if (buyerIdentity) {
    const fakturaRow = await admin
      .from("ksef_invoices")
      .insert({
        stripe_purchase_id: purchase.data.id,
        kind: "vat",
        gov_status: "pending"
      })
      .select("id")
      .single();

    if (fakturaRow.error) {
      console.error(
        `[webhook] failed to create ksef_invoices row for ${purchase.data.id}:`,
        fakturaRow.error
      );
      // Don't throw — credits are already granted; the cron can be primed manually if needed.
      return;
    }

    // Optionally: try issuing immediately for happy-path latency. The cron is
    // the safety net. We gate the inline attempt on KSEF_LIVE so dev shells
    // don't call iFirma by accident.
    if (process.env.KSEF_LIVE === "true") {
      await tryIssueFakturaInline(admin, fakturaRow.data.id, purchase.data.id);
    }
  }
}

/**
 * Best-effort payment confirmation email. The buyer already paid and got
 * their credits, so an email failure must never fail the webhook — Stripe
 * would retry and we would risk duplicate processing. The email tells the
 * buyer the VAT invoice arrives via KSeF, not by email.
 */
async function trySendPaymentConfirmationEmail(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  session: Stripe.Checkout.Session,
  info: { userId: string; packageSize: number; buyerEmail: string | null }
): Promise<void> {
  try {
    if (!info.buyerEmail) {
      console.warn(
        `[webhook] no buyer email on session ${session.id} — skipping confirmation email`
      );
      return;
    }
    if (session.amount_total === null || !session.currency) {
      console.warn(
        `[webhook] session ${session.id} missing amount_total/currency — skipping confirmation email`
      );
      return;
    }
    const sendEmail = createResendSendFn(process.env.RESEND_API_KEY);
    if (!sendEmail) {
      console.warn("[webhook] RESEND_API_KEY missing — skipping confirmation email");
      return;
    }

    await sendPaymentConfirmationEmail({
      supabase: admin,
      sendEmail,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      fromAddress: process.env.RESEND_BILLING_FROM_ADDRESS,
      userId: info.userId,
      recipientEmail: info.buyerEmail,
      packageSize: info.packageSize,
      amountPaidCents: session.amount_total,
      currency: session.currency
    });
  } catch (error) {
    console.error(
      `[webhook] payment confirmation email failed for session ${session.id}:`,
      error
    );
  }
}

/**
 * Best-effort inline faktura issuance from the webhook. Wrapped in a
 * try/catch because the webhook MUST return 200 quickly — Stripe retries
 * non-2xx and we don't want an iFirma outage to trigger duplicate
 * credit grants. Failures are silent here; the cron picks up the row.
 *
 * Two-step issue: create the faktura in iFirma (returns provider_invoice_id),
 * persist that id immediately, then submit to KSeF. Persisting between
 * the two calls means a crash mid-flow leaves the cron a clear hand-off
 * point — it resumes from provider_invoice_id and just retries sendToKsef.
 */
async function tryIssueFakturaInline(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  ksefInvoiceRowId: string,
  stripePurchaseId: string
): Promise<void> {
  try {
    const fullRow = await admin
      .from("stripe_purchases")
      .select(
        "id, package_size, unit_price_cents, total_amount_cents, currency, buyer_nip, buyer_business_name, buyer_email, buyer_address_line1, buyer_address_line2, buyer_postal_code, buyer_city, buyer_country, created_at"
      )
      .eq("id", stripePurchaseId)
      .single();
    if (fullRow.error || !fullRow.data) {
      console.error(
        `[webhook] failed to reload stripe_purchases ${stripePurchaseId} for inline faktura`
      );
      return;
    }

    // Step 1: create the invoice in iFirma.
    const body = buildIfirmaFaktura(fullRow.data);
    const { providerInvoiceId } = await issueFaktura(body);

    // Persist the provider id immediately so a crash before the KSeF send
    // doesn't lose it (the cron resumes from provider_invoice_id).
    await admin
      .from("ksef_invoices")
      .update({ provider_invoice_id: providerInvoiceId, attempt_count: 1 })
      .eq("id", ksefInvoiceRowId);

    // Step 2: submit to KSeF.
    await sendToKsef(providerInvoiceId, { korekta: false });

    await admin
      .from("ksef_invoices")
      .update({ gov_status: "processing", last_error: null })
      .eq("id", ksefInvoiceRowId);
  } catch (error) {
    console.error(
      `[webhook] inline iFirma issue failed for purchase ${stripePurchaseId}:`,
      error
    );
    await admin
      .from("ksef_invoices")
      .update({
        gov_status: "failed",
        last_error: error instanceof Error ? error.message : String(error),
        attempt_count: 1
      })
      .eq("id", ksefInvoiceRowId);
  }
}

/**
 * A delayed-confirmation payment (BLIK, P24) definitively failed after the
 * session completed. Flip the pending purchase to failed so it doesn't sit
 * in "pending" forever; nothing was granted, so nothing needs reverting.
 * The pending-only guard keeps a late/duplicate failure event from
 * clobbering a purchase that already succeeded.
 */
async function handleAsyncPaymentFailed(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  session: Stripe.Checkout.Session
): Promise<void> {
  const purchase = await admin
    .from("stripe_purchases")
    .update({ status: "failed" })
    .eq("stripe_checkout_session_id", session.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (purchase.data) {
    console.warn(
      `[webhook] delayed payment failed for session ${session.id} — purchase ${purchase.data.id} marked failed`
    );
  }
}

async function handleChargeRefunded(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  charge: Stripe.Charge
): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) return;

  const purchase = await admin
    .from("stripe_purchases")
    .select("id, user_id, package_size, status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (!purchase.data) {
    console.warn(
      `[webhook] no stripe_purchases row for payment_intent ${paymentIntentId}`
    );
    return;
  }

  if (purchase.data.status === "refunded") {
    return; // Idempotent.
  }

  // Only auto-revoke the full package on a FULL refund. A partial refund (e.g.
  // a goodwill gesture) must not silently claw back every credit, nor can we
  // infer the correct proportion safely — flag it for an operator instead.
  const fullyRefunded =
    charge.refunded === true &&
    typeof charge.amount === "number" &&
    charge.amount_refunded === charge.amount;
  if (!fullyRefunded) {
    console.warn(
      `[webhook] partial refund on charge ${charge.id} ` +
        `(${charge.amount_refunded}/${charge.amount}) — flagging for review, not auto-revoking`
    );
    await admin
      .from("stripe_purchases")
      .update({ needs_manual_review: true })
      .eq("id", purchase.data.id);
    return;
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

  // Look up the original vat faktura to link the korekta.
  const original = await admin
    .from("ksef_invoices")
    .select("id")
    .eq("stripe_purchase_id", purchase.data.id)
    .eq("kind", "vat")
    .maybeSingle();

  if (!original.data) {
    console.warn(
      `[webhook] no original ksef_invoices row for purchase ${purchase.data.id} — korekta deferred`
    );
    return;
  }

  // Insert a pending korekta row; the cron will issue it once the parent
  // has a confirmed gov_id.
  await admin.from("ksef_invoices").insert({
    stripe_purchase_id: purchase.data.id,
    kind: "correction",
    parent_id: original.data.id,
    gov_status: "pending"
  });
}
