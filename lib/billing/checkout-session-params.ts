import type Stripe from "stripe";
import type { PriceQuote } from "./pricing";

export interface CheckoutSessionInput {
  quote: PriceQuote;
  purchaseId: string;
  userId: string;
  userEmail: string | undefined;
  appUrl: string;
  /**
   * Stripe Tax Rate object (txr_...) holding the static 23% PL VAT rate.
   * We deliberately do NOT use Stripe Tax (automatic_tax): the business is
   * PL-B2B-only with a single fixed rate, the legal faktura comes from
   * iFirma which hardcodes the same 23%, and a static rate keeps both
   * sides in agreement by construction (and skips the Stripe Tax fee).
   */
  taxRateId: string;
}

export class MissingTaxRateError extends Error {
  constructor() {
    super("STRIPE_TAX_RATE_ID is not configured.");
    this.name = "MissingTaxRateError";
  }
}

export function buildCheckoutSessionParams(
  input: CheckoutSessionInput
): Stripe.Checkout.SessionCreateParams {
  const taxRateId = input.taxRateId.trim();
  if (!taxRateId) {
    throw new MissingTaxRateError();
  }

  const { quote, purchaseId, userId, userEmail, appUrl } = input;

  // payment_method_types is deliberately omitted: Stripe then uses the
  // dashboard's payment-method settings, so enabling/disabling BLIK, P24
  // or cards is an ops action, not a deploy. Delayed-confirmation methods
  // are handled via checkout.session.async_payment_* webhooks.
  return {
    mode: "payment",
    currency: quote.currency,
    line_items: [
      {
        quantity: quote.packageSize,
        tax_rates: [taxRateId],
        price_data: {
          currency: quote.currency,
          unit_amount: quote.unitPriceCents,
          product_data: {
            name: `KSeF Translator — ${quote.packageSize} kredytów`,
            description: "Pakiet kredytów na tłumaczenie faktur KSeF"
          }
        }
      }
    ],
    // B2B-only flow: customer MUST supply a tax ID (NIP or EU VAT).
    // Stripe's tax-ID UI captures the legal business name alongside the ID.
    // NOTE: Stripe SDK 22.1.1 only types `"if_supported" | "never"` for
    // tax_id_collection.required; the API spec also accepts "always" but
    // the SDK lags. Using "if_supported" keeps types green and is
    // functionally equivalent in PL where pl_nip is always supported.
    tax_id_collection: {
      enabled: true,
      required: "if_supported"
    },
    billing_address_collection: "required",
    // We need a Stripe Customer object so customer_details.tax_ids land in a
    // persistent place we can re-query from the webhook.
    customer_creation: "always",
    // We no longer rely on Stripe-issued invoices — iFirma issues the legal
    // KSeF document. Removing `invoice_creation` saves the per-invoice Stripe
    // fee (0.4%) and avoids confusing the customer with two PDFs.
    customer_email: userEmail,
    client_reference_id: purchaseId,
    success_url: `${appUrl}/billing?status=paid&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/billing?status=cancelled`,
    metadata: {
      purchase_id: purchaseId,
      user_id: userId,
      package_size: String(quote.packageSize)
    }
  };
}
