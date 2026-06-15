"use client";

import { useEffect, useRef } from "react";

interface PurchaseConversionProps {
  /** Stripe Checkout Session id (cs_...), used as the conversion transaction_id. */
  sessionId: string | undefined;
  /** Net order value (ex-VAT), in the major currency unit. Omitted if unknown. */
  value?: number;
  /** ISO 4217 currency code, e.g. "PLN". */
  currency?: string;
}

/**
 * Emits a single `purchase` event into the GTM dataLayer after a successful
 * checkout, carrying the Stripe session id as `transaction_id` plus the order
 * value and currency when known. A GTM trigger fires the Google Ads conversion
 * off this event (subject to consent), mapping Conversion Value/Currency to the
 * `value`/`currency` keys and Transaction ID to `transaction_id` (which lets
 * Google dedup if the success page is refreshed). Renders no DOM. Whether the
 * conversion actually sends is decided by the tag-level consent settings inside
 * GTM, not here.
 */
export function PurchaseConversion({ sessionId, value, currency }: PurchaseConversionProps) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current || !sessionId || typeof window === "undefined") return;
    const event: Record<string, unknown> = { event: "purchase", transaction_id: sessionId };
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      event.value = value;
      if (currency) event.currency = currency;
    }
    const w = window as { dataLayer?: Array<Record<string, unknown>> };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push(event);
    pushed.current = true;
  }, [sessionId, value, currency]);

  return null;
}
