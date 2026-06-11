export const CONSENT_COOKIE_NAME = "cookie_consent";

/** Bump to re-prompt every visitor after a material change to categories or purposes. */
export const CONSENT_VERSION = 1;

export const CONSENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Window event dispatched by footer links to reopen the settings modal. */
export const OPEN_COOKIE_SETTINGS_EVENT = "ksef:open-cookie-settings";

export type ConsentLocale = "pl" | "en";

export interface ConsentPreferences {
  analytics: boolean;
  marketing: boolean;
}

export interface ConsentState {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  version: number;
  decidedAt: string;
}
