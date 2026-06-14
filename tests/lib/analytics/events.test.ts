import { describe, expect, it } from "vitest";
import { EVENT_PROPERTY_KEYS } from "@/lib/analytics/events";

// Spec §4 PII rules: invoice content must never enter event properties.
const FORBIDDEN_KEY_PATTERNS = [
  /nip/i,
  /vat_id/i,
  /iban/i,
  /swift/i,
  /file_?name/i,
  /party/i,
  /buyer/i,
  /seller/i,
  /invoice_number/i,
  /email/i,
  /first_name/i,
  /last_name/i,
  /display_name/i,
  /address/i
];

describe("analytics event catalog", () => {
  it("defines the 28 catalog events", () => {
    expect(Object.keys(EVENT_PROPERTY_KEYS).sort()).toEqual(
      [
        "auth_failed",
        "checkout_initiated",
        "checkout_session_created",
        "demo_download_gate_opened",
        "demo_email_submitted",
        "demo_file_uploaded",
        "demo_language_selected",
        "demo_pdf_downloaded",
        "demo_translation_completed",
        "demo_translation_failed",
        "files_uploaded",
        "google_signin_clicked",
        "invoice_translated",
        "landing_cta_clicked",
        "login_completed",
        "login_email_sent",
        "login_submitted",
        "onboarding_name_completed",
        "onboarding_name_shown",
        "payment_completed",
        "payment_failed",
        "payment_refunded",
        "pdf_downloaded",
        "signed_out",
        "signup_completed",
        "translation_batch_cancelled",
        "translation_started",
        "zip_downloaded"
      ].sort()
    );
  });

  it("derives frozen property key lists", () => {
    expect(Object.isFrozen(EVENT_PROPERTY_KEYS)).toBe(true);
  });

  it("contains no forbidden PII property keys", () => {
    for (const [event, keys] of Object.entries(EVENT_PROPERTY_KEYS)) {
      for (const key of keys) {
        for (const pattern of FORBIDDEN_KEY_PATTERNS) {
          expect(
            pattern.test(key),
            `${event}.${key} matches forbidden pattern ${pattern}`
          ).toBe(false);
        }
      }
    }
  });
});
