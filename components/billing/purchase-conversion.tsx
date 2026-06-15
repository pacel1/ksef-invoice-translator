"use client";

import { useEffect, useRef } from "react";

interface PurchaseConversionProps {
  /** Stripe Checkout Session id (cs_...), used as the conversion transaction_id. */
  sessionId: string | undefined;
}

/**
 * Emits a single `purchase` event into the GTM dataLayer after a successful
 * checkout, carrying the Stripe session id as `transaction_id`. A GTM trigger
 * fires the Google Ads conversion off this event (subject to consent), and the
 * transaction_id lets Google dedup if the success page is refreshed. Renders
 * no DOM. Whether the conversion actually sends is decided by the tag-level
 * consent settings inside GTM, not here.
 */
export function PurchaseConversion({ sessionId }: PurchaseConversionProps) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current || !sessionId || typeof window === "undefined") return;
    const w = window as { dataLayer?: Array<Record<string, unknown>> };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event: "purchase", transaction_id: sessionId });
    pushed.current = true;
  }, [sessionId]);

  return null;
}
