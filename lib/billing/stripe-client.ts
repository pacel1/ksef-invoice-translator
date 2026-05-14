import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (typeof window !== "undefined") {
    throw new Error("Stripe server SDK must never be used in the browser.");
  }
  if (!cached) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured.");
    }
    cached = new Stripe(key, {
      apiVersion: "2026-04-22.dahlia",
      typescript: true
    });
  }
  return cached;
}
