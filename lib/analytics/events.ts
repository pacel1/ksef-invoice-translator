/**
 * Single source of truth for every PostHog event this app emits.
 *
 * PII rules (spec §4, hard constraints):
 * - Never capture invoice content: file names, party names, NIP/VAT ids,
 *   IBAN/SWIFT, invoice numbers, invoice amounts, emails.
 * - Allowed: counts, byte sizes, language codes, booleans, error codes,
 *   durations, credit package sizes and package prices, internal UUIDs
 *   (invoice_id, user id) and Stripe ids.
 *
 * Adding an event: extend AnalyticsEventMap AND EVENT_PROPERTY_KEYS.
 * The `satisfies` clause keeps the two in sync at compile time; the PII
 * test in tests/lib/analytics/events.test.ts vets the property names.
 */

export interface AnalyticsEventMap {
  login_submitted: { method: "email_otp" };
  google_signin_clicked: Record<string, never>;
  login_email_sent: { method: "email_otp" };
  files_uploaded: {
    file_count: number;
    success_count: number;
    failure_count: number;
  };
  translation_started: {
    file_count: number;
    language: string;
    bilingual: boolean;
  };
  translation_batch_cancelled: { total: number; done: number };
  pdf_downloaded: {
    invoice_id: string;
    language: string;
    bilingual: boolean;
    context: "single" | "batch_row";
  };
  zip_downloaded: {
    invoice_count: number;
    language: string;
    bilingual: boolean;
  };
  checkout_initiated: { package_size: number; total_net_pln?: number };
  checkout_session_created: {
    package_size: number;
    total_amount_cents: number;
    currency: string;
    stripe_session_id: string;
  };
  payment_completed: {
    package_size: number;
    total_amount_cents: number;
    currency: string;
    stripe_session_id: string;
  };
  payment_failed: { stripe_session_id: string; purchase_id: string };
  payment_refunded: { package_size: number; stripe_charge_id: string };
  invoice_translated: {
    invoice_id: string;
    language: string;
    bilingual: boolean;
    cache_hit: boolean;
    used_ai: boolean;
    duration_ms: number;
  };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

export const EVENT_PROPERTY_KEYS = {
  login_submitted: ["method"],
  google_signin_clicked: [],
  login_email_sent: ["method"],
  files_uploaded: ["file_count", "success_count", "failure_count"],
  translation_started: ["file_count", "language", "bilingual"],
  translation_batch_cancelled: ["total", "done"],
  pdf_downloaded: ["invoice_id", "language", "bilingual", "context"],
  zip_downloaded: ["invoice_count", "language", "bilingual"],
  checkout_initiated: ["package_size", "total_net_pln"],
  checkout_session_created: [
    "package_size",
    "total_amount_cents",
    "currency",
    "stripe_session_id"
  ],
  payment_completed: [
    "package_size",
    "total_amount_cents",
    "currency",
    "stripe_session_id"
  ],
  payment_failed: ["stripe_session_id", "purchase_id"],
  payment_refunded: ["package_size", "stripe_charge_id"],
  invoice_translated: [
    "invoice_id",
    "language",
    "bilingual",
    "cache_hit",
    "used_ai",
    "duration_ms"
  ]
} as const satisfies {
  [K in AnalyticsEventName]: readonly (keyof AnalyticsEventMap[K] & string)[];
};
