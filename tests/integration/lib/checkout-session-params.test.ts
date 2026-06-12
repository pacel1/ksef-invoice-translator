import { describe, it, expect } from "vitest";
import {
  buildCheckoutSessionParams,
  MissingTaxRateError,
  type CheckoutSessionInput
} from "@/lib/billing/checkout-session-params";
import { priceForPackage } from "@/lib/billing/pricing";

function makeInput(overrides: Partial<CheckoutSessionInput> = {}): CheckoutSessionInput {
  return {
    quote: priceForPackage(25),
    purchaseId: "11111111-2222-3333-4444-555555555555",
    userId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    userEmail: "buyer@example.test",
    appUrl: "https://app.example.test",
    taxRateId: "txr_static_pl_vat",
    ...overrides
  };
}

describe("buildCheckoutSessionParams", () => {
  it("applies the static PL VAT tax rate to the line item", () => {
    const params = buildCheckoutSessionParams(makeInput());
    expect(params.line_items).toHaveLength(1);
    expect(params.line_items?.[0]?.tax_rates).toEqual(["txr_static_pl_vat"]);
  });

  it("does not enable Stripe automatic tax", () => {
    const params = buildCheckoutSessionParams(makeInput());
    expect(params.automatic_tax).toBeUndefined();
  });

  it("does not set tax_behavior on price_data (net price + manual rate instead)", () => {
    const params = buildCheckoutSessionParams(makeInput());
    expect(params.line_items?.[0]?.price_data?.tax_behavior).toBeUndefined();
  });

  it("charges the net unit price and package quantity from the quote", () => {
    const quote = priceForPackage(50);
    const params = buildCheckoutSessionParams(makeInput({ quote }));
    const item = params.line_items?.[0];
    expect(item?.quantity).toBe(50);
    expect(item?.price_data?.unit_amount).toBe(quote.unitPriceCents);
    expect(item?.price_data?.currency).toBe("pln");
  });

  it("keeps the B2B collection config (tax id, billing address, customer creation)", () => {
    const params = buildCheckoutSessionParams(makeInput());
    expect(params.tax_id_collection).toEqual({ enabled: true, required: "if_supported" });
    expect(params.billing_address_collection).toBe("required");
    expect(params.customer_creation).toBe("always");
    expect(params.mode).toBe("payment");
  });

  it("leaves payment methods to the Stripe dashboard (no hardcoded list)", () => {
    // Hardcoding payment_method_types makes Stripe ignore the dashboard's
    // payment-method settings — BLIK/P24 enabled there would never show.
    const params = buildCheckoutSessionParams(makeInput());
    expect(params.payment_method_types).toBeUndefined();
  });

  it("wires purchase metadata, client reference and redirect URLs", () => {
    const params = buildCheckoutSessionParams(makeInput());
    expect(params.client_reference_id).toBe("11111111-2222-3333-4444-555555555555");
    expect(params.metadata).toEqual({
      purchase_id: "11111111-2222-3333-4444-555555555555",
      user_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      package_size: "25"
    });
    expect(params.customer_email).toBe("buyer@example.test");
    expect(params.success_url).toBe(
      "https://app.example.test/billing?status=paid&session_id={CHECKOUT_SESSION_ID}"
    );
    expect(params.cancel_url).toBe("https://app.example.test/billing?status=cancelled");
  });

  it("expires the session one hour out so abandoned checkouts terminate quickly", () => {
    const before = Math.floor(Date.now() / 1000);
    const params = buildCheckoutSessionParams(makeInput());
    const after = Math.floor(Date.now() / 1000);
    // Stripe allows 30min–24h; 1h matches the pending-session spam window
    // in abuse-caps so an abandoned session is dead by the time it stops
    // counting against the cap.
    expect(params.expires_at).toBeGreaterThanOrEqual(before + 3600);
    expect(params.expires_at).toBeLessThanOrEqual(after + 3600);
  });

  it("throws MissingTaxRateError when the tax rate id is blank", () => {
    expect(() => buildCheckoutSessionParams(makeInput({ taxRateId: "" }))).toThrow(
      MissingTaxRateError
    );
    expect(() => buildCheckoutSessionParams(makeInput({ taxRateId: "   " }))).toThrow(
      MissingTaxRateError
    );
  });
});
