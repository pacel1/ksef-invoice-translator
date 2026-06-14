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
 * Adding an event: extend AnalyticsEventMap AND EVENT_PROPERTY_WITNESS.
 * EVENT_PROPERTY_WITNESS is typed Record<keyof Payload, true> per event, so
 * the compiler forces every property (optional ones included) to be listed
 * and rejects unknown keys; the runtime key list can never silently miss a
 * property added to the map. The PII test in
 * tests/lib/analytics/events.test.ts vets the property names.
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

  // ── Marketing / landing ───────────────────────────────────────────
  landing_cta_clicked: {
    cta_id:
      | "hero_primary"
      | "hero_secondary"
      | "nav_login"
      | "mobile_nav"
      | "pricing_teaser"
      | "final_cta";
    locale: string;
  };

  // ── Demo funnel (anonymous, landing page) ─────────────────────────
  demo_language_selected: { language: string; lane: "sample" | "upload" };
  demo_file_uploaded: {
    status: "success" | "invalid" | "rate_limited" | "error";
    error_code?: string;
  };
  demo_translation_completed: { language: string; lane: "sample" | "upload" };
  demo_translation_failed: {
    language: string;
    lane: "sample" | "upload";
    error_code: string;
  };
  demo_download_gate_opened: {
    trigger: "download" | "more_languages";
    lane: "sample" | "upload";
  };
  demo_email_submitted: {
    status: "success" | "rate_limited" | "error";
    marketing_opt_in: boolean;
    lane: "sample" | "upload";
  };
  demo_pdf_downloaded: { language: string; lane: "sample" | "upload" };

  // ── Auth / onboarding ─────────────────────────────────────────────
  signup_completed: {
    method: "magic_link" | "google";
    signup_source: "landing_demo" | "direct";
  };
  login_completed: { method: "magic_link" | "google" };
  auth_failed: { reason: string };
  onboarding_name_shown: Record<string, never>;
  onboarding_name_completed: Record<string, never>;
  signed_out: Record<string, never>;
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

/** Header that stitches a client PostHog session onto server-side captures. */
export const POSTHOG_SESSION_HEADER = "x-posthog-session-id";

/**
 * Witness object: Record<keyof Payload, true> forces every payload key
 * (including optional ones) to be listed, and rejects unknown keys, so the
 * runtime key list below can never silently miss a property added to
 * AnalyticsEventMap. The PII guard test scans EVENT_PROPERTY_KEYS, which is
 * derived from this witness.
 */
const EVENT_PROPERTY_WITNESS: {
  [K in AnalyticsEventName]: Record<keyof AnalyticsEventMap[K], true>;
} = {
  login_submitted: { method: true },
  google_signin_clicked: {},
  login_email_sent: { method: true },
  files_uploaded: { file_count: true, success_count: true, failure_count: true },
  translation_started: { file_count: true, language: true, bilingual: true },
  translation_batch_cancelled: { total: true, done: true },
  pdf_downloaded: { invoice_id: true, language: true, bilingual: true, context: true },
  zip_downloaded: { invoice_count: true, language: true, bilingual: true },
  checkout_initiated: { package_size: true, total_net_pln: true },
  checkout_session_created: {
    package_size: true,
    total_amount_cents: true,
    currency: true,
    stripe_session_id: true
  },
  payment_completed: {
    package_size: true,
    total_amount_cents: true,
    currency: true,
    stripe_session_id: true
  },
  payment_failed: { stripe_session_id: true, purchase_id: true },
  payment_refunded: { package_size: true, stripe_charge_id: true },
  invoice_translated: {
    invoice_id: true,
    language: true,
    bilingual: true,
    cache_hit: true,
    used_ai: true,
    duration_ms: true
  },
  landing_cta_clicked: { cta_id: true, locale: true },
  demo_language_selected: { language: true, lane: true },
  demo_file_uploaded: { status: true, error_code: true },
  demo_translation_completed: { language: true, lane: true },
  demo_translation_failed: { language: true, lane: true, error_code: true },
  demo_download_gate_opened: { trigger: true, lane: true },
  demo_email_submitted: { status: true, marketing_opt_in: true, lane: true },
  demo_pdf_downloaded: { language: true, lane: true },
  signup_completed: { method: true, signup_source: true },
  login_completed: { method: true },
  auth_failed: { reason: true },
  onboarding_name_shown: {},
  onboarding_name_completed: {},
  signed_out: {}
};

export const EVENT_PROPERTY_KEYS = Object.freeze(
  Object.fromEntries(
    Object.entries(EVENT_PROPERTY_WITNESS).map(([event, witness]) => [
      event,
      Object.keys(witness)
    ])
  )
) as unknown as {
  [K in AnalyticsEventName]: readonly (keyof AnalyticsEventMap[K] & string)[];
};
