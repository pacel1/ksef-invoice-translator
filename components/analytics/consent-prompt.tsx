"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import {
  persistenceFor,
  readConsentChoice,
  shouldShowConsentPrompt,
  storeConsentChoice,
  type ConsentValue
} from "@/lib/analytics/consent";

const COPY = {
  pl: {
    body: "Analityka działa u nas bez plików cookie. Jeśli się zgodzisz, zapamiętamy Cię między wizytami i łatwiej nam będzie ulepszać produkt.",
    accept: "Zgadzam się",
    decline: "Nie teraz",
    ariaLabel: "Zgoda na pliki cookie analityki"
  },
  en: {
    body: "Our analytics works without cookies. If you agree, we will remember you between visits, which helps us improve the product.",
    accept: "Accept",
    decline: "Not now",
    ariaLabel: "Analytics cookie consent"
  }
} as const;

export function ConsentPrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  // Reading localStorage is an external-system sync, so useEffect is the
  // right tool here; it also avoids an SSR hydration mismatch.
  useEffect(() => {
    setVisible(
      shouldShowConsentPrompt(readConsentChoice(window.localStorage), new Date())
    );
  }, []);

  if (!visible) return null;

  const locale = pathname?.startsWith("/en") ? "en" : "pl";
  const t = COPY[locale];

  function choose(value: ConsentValue) {
    const choice = storeConsentChoice(window.localStorage, value, new Date());
    posthog.set_config({ persistence: persistenceFor(choice) });
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label={t.ariaLabel}
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-border bg-surface p-4 shadow-lg"
    >
      <p className="text-small text-text">{t.body}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => choose("accepted")}
          className="rounded-md bg-text-strong px-3 py-2 text-small font-medium text-surface hover:opacity-90"
        >
          {t.accept}
        </button>
        <button
          type="button"
          onClick={() => choose("declined")}
          className="rounded-md px-3 py-2 text-small text-text hover:bg-surface-muted"
        >
          {t.decline}
        </button>
      </div>
    </div>
  );
}
