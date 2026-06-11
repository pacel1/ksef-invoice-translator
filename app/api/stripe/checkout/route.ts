import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/billing/stripe-client";
import { buildCheckoutSessionParams } from "@/lib/billing/checkout-session-params";
import {
  InvalidPackageSizeError,
  isValidPackageSize,
  priceForPackage
} from "@/lib/billing/pricing";
import { AbuseCapError, assertWithinAbuseCaps } from "@/lib/billing/abuse-caps";
import { getPostHogClient } from "@/lib/posthog-server";

export const runtime = "nodejs";

const bodySchema = z.object({
  packageSize: z.number().int()
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success || !isValidPackageSize(parsed.data.packageSize)) {
    return NextResponse.json({ error: "Invalid packageSize" }, { status: 400 });
  }
  const packageSize = parsed.data.packageSize;

  // Fail fast before persisting anything — without the static VAT rate the
  // session would charge net only and disagree with the iFirma faktura.
  const taxRateId = process.env.STRIPE_TAX_RATE_ID;
  if (!taxRateId || taxRateId.trim() === "") {
    console.error("[api/stripe/checkout] STRIPE_TAX_RATE_ID is not configured");
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }

  const admin = getSupabaseAdminClient();

  try {
    await assertWithinAbuseCaps({ supabase: admin, userId: userData.user.id, requestedPackageSize: packageSize });
  } catch (error) {
    if (error instanceof AbuseCapError) {
      return NextResponse.json(
        { error: "Purchase rate limit exceeded", code: error.reason },
        { status: 429 }
      );
    }
    console.error("[api/stripe/checkout] abuse-cap lookup failed:", error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }

  let quote;
  try {
    quote = priceForPackage(packageSize);
  } catch (error) {
    if (error instanceof InvalidPackageSizeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const pending = await admin
    .from("stripe_purchases")
    .insert({
      user_id: userData.user.id,
      stripe_checkout_session_id: `pending-${crypto.randomUUID()}`,
      package_size: packageSize,
      unit_price_cents: quote.unitPriceCents,
      total_amount_cents: quote.totalAmountCents,
      currency: quote.currency,
      status: "pending"
    })
    .select("id")
    .single();

  if (pending.error || !pending.data) {
    console.error("[api/stripe/checkout] failed to persist pending purchase:", pending.error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }

  const stripe = getStripeClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams({
        quote,
        purchaseId: pending.data.id,
        userId: userData.user.id,
        userEmail: userData.user.email,
        appUrl,
        taxRateId
      })
    );

    // Replace the placeholder session id we used to satisfy the unique constraint.
    await admin
      .from("stripe_purchases")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", pending.data.id);

    getPostHogClient().capture({
      distinctId: userData.user.id,
      event: "checkout_session_created",
      properties: {
        package_size: packageSize,
        total_amount_cents: quote.totalAmountCents,
        currency: quote.currency,
        stripe_session_id: session.id
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[api/stripe/checkout] Stripe session creation failed:", error);
    await admin
      .from("stripe_purchases")
      .update({ status: "failed" })
      .eq("id", pending.data.id);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
