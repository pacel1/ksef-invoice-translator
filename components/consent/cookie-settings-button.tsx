"use client";

import { consentCopy } from "@/lib/consent/copy";
import { OPEN_COOKIE_SETTINGS_EVENT, type ConsentLocale } from "@/lib/consent/types";

export interface CookieSettingsButtonProps {
  locale: ConsentLocale;
  className?: string;
}

/** Footer link that reopens the consent settings modal from anywhere on the site. */
export function CookieSettingsButton({ locale, className }: CookieSettingsButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
    >
      {consentCopy[locale].footerLink}
    </button>
  );
}
