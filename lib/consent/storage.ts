import { z } from "zod";
import {
  CONSENT_COOKIE_MAX_AGE_SECONDS,
  CONSENT_COOKIE_NAME,
  CONSENT_VERSION,
  type ConsentPreferences,
  type ConsentState
} from "./types";

const consentStateSchema = z.object({
  necessary: z.literal(true),
  analytics: z.boolean(),
  marketing: z.boolean(),
  version: z.number().int(),
  decidedAt: z.string()
});

export function createConsentState(preferences: ConsentPreferences, decidedAt: Date): ConsentState {
  return {
    necessary: true,
    analytics: preferences.analytics,
    marketing: preferences.marketing,
    version: CONSENT_VERSION,
    decidedAt: decidedAt.toISOString()
  };
}

export function serializeConsentValue(state: ConsentState): string {
  return encodeURIComponent(JSON.stringify(state));
}

export function parseConsentValue(raw: string | null | undefined): ConsentState | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  const result = consentStateSchema.safeParse(parsed);
  if (!result.success) return null;
  if (result.data.version !== CONSENT_VERSION) return null;
  return result.data;
}

/** Reads the consent state out of a `document.cookie`-style string. */
export function readStoredConsent(cookieString: string): ConsentState | null {
  const entry = cookieString
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (!entry) return null;
  return parseConsentValue(entry.slice(CONSENT_COOKIE_NAME.length + 1));
}

export function buildConsentCookie(state: ConsentState, secure: boolean): string {
  const base = [
    `${CONSENT_COOKIE_NAME}=${serializeConsentValue(state)}`,
    "Path=/",
    `Max-Age=${CONSENT_COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax"
  ];
  return (secure ? [...base, "Secure"] : base).join("; ");
}
