"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { consentCopy } from "@/lib/consent/copy";
import type { ConsentLocale } from "@/lib/consent/types";

export interface CookieBannerProps {
  locale: ConsentLocale;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onOpenSettings: () => void;
}

export function CookieBanner({ locale, onAcceptAll, onRejectAll, onOpenSettings }: CookieBannerProps) {
  const t = consentCopy[locale].banner;
  const privacyHref = locale === "en" ? "/en/privacy" : "/privacy";

  return (
    <div
      role="region"
      aria-label={consentCopy[locale].modal.title}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface shadow-lg"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:gap-8 md:px-8">
        <p className="text-small text-text">
          {t.body} {t.privacyPrefix}
          <Link href={privacyHref} className="font-medium text-accent underline underline-offset-2 hover:text-accent-hover">
            {t.privacyLinkLabel}
          </Link>
          {t.privacySuffix}
        </p>
        <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Button onClick={onAcceptAll}>{t.acceptAll}</Button>
          <Button onClick={onRejectAll}>{t.rejectAll}</Button>
          <Button variant="ghost" onClick={onOpenSettings}>{t.settings}</Button>
        </div>
      </div>
    </div>
  );
}
