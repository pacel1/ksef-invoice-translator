"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CookieBanner } from "./cookie-banner";
import { ConsentSettingsModal } from "./consent-settings-modal";
import { GoogleAdsTag } from "./google-ads-tag";
import { PostHogConsentSync } from "@/components/analytics/posthog-consent-sync";
import { localeFromPathname } from "@/lib/consent/locale";
import { pushConsentUpdate } from "@/lib/consent/gtag";
import { buildConsentCookie, createConsentState, readStoredConsent } from "@/lib/consent/storage";
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  type ConsentLocale,
  type ConsentPreferences,
  type ConsentState
} from "@/lib/consent/types";

export interface ConsentContextValue {
  consent: ConsentState | null;
  locale: ConsentLocale;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (preferences: ConsentPreferences) => void;
  openSettings: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function useConsent(): ConsentContextValue {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error("useConsent must be used inside <ConsentProvider>");
  }
  return context;
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = localeFromPathname(pathname ?? "/");
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setConsent(readStoredConsent(document.cookie));
    setHydrated(true);
  }, []);

  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
  }, []);

  const decide = useCallback((preferences: ConsentPreferences) => {
    const state = createConsentState(preferences, new Date());
    try {
      document.cookie = buildConsentCookie(state, window.location.protocol === "https:");
    } catch {
      // Cookie writes can fail in locked-down browsers; the in-memory state
      // still applies for this session and the banner will re-prompt later.
    }
    setConsent(state);
    setSettingsOpen(false);
    pushConsentUpdate(state);
  }, []);

  const acceptAll = useCallback(() => decide({ analytics: true, marketing: true }), [decide]);
  const rejectAll = useCallback(() => decide({ analytics: false, marketing: false }), [decide]);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const value = useMemo<ConsentContextValue>(
    () => ({ consent, locale, acceptAll, rejectAll, savePreferences: decide, openSettings }),
    [consent, locale, acceptAll, rejectAll, decide, openSettings]
  );

  const bannerVisible = hydrated && consent === null && !settingsOpen;

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {bannerVisible && (
        <CookieBanner
          locale={locale}
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onOpenSettings={openSettings}
        />
      )}
      {settingsOpen && (
        <ConsentSettingsModal
          locale={locale}
          consent={consent}
          onSave={decide}
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onClose={closeSettings}
        />
      )}
      <GoogleAdsTag />
      <PostHogConsentSync consent={consent} />
    </ConsentContext.Provider>
  );
}
