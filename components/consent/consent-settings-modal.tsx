"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { consentCopy } from "@/lib/consent/copy";
import type { ConsentLocale, ConsentPreferences, ConsentState } from "@/lib/consent/types";

export interface ConsentSettingsModalProps {
  locale: ConsentLocale;
  consent: ConsentState | null;
  onSave: (preferences: ConsentPreferences) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onClose: () => void;
}

export function ConsentSettingsModal({
  locale,
  consent,
  onSave,
  onAcceptAll,
  onRejectAll,
  onClose
}: ConsentSettingsModalProps) {
  const t = consentCopy[locale].modal;
  const dialogRef = useRef<HTMLDivElement>(null);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    analytics: consent?.analytics ?? false,
    marketing: consent?.marketing ?? false
  });

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const trapFocus = (event: React.KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-settings-title"
        tabIndex={-1}
        onKeyDown={trapFocus}
        className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-lg focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="consent-settings-title" className="text-h3 font-semibold text-text-strong">
            {t.title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t.close}
          </Button>
        </div>
        <p className="mt-2 text-small text-text-muted">{t.description}</p>

        <div className="mt-5 space-y-5">
          <div>
            <Switch checked disabled onCheckedChange={() => undefined} label={t.categories.necessary.label} />
            <p className="mt-1 text-small text-text-muted">
              {t.categories.necessary.description} {t.alwaysOn}.
            </p>
          </div>
          <div>
            <Switch
              checked={preferences.analytics}
              onCheckedChange={(checked) => setPreferences((prev) => ({ ...prev, analytics: checked }))}
              label={t.categories.analytics.label}
            />
            <p className="mt-1 text-small text-text-muted">{t.categories.analytics.description}</p>
          </div>
          <div>
            <Switch
              checked={preferences.marketing}
              onCheckedChange={(checked) => setPreferences((prev) => ({ ...prev, marketing: checked }))}
              label={t.categories.marketing.label}
            />
            <p className="mt-1 text-small text-text-muted">{t.categories.marketing.description}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onRejectAll}>{t.rejectAll}</Button>
          <Button variant="outline" onClick={onAcceptAll}>{t.acceptAll}</Button>
          <Button onClick={() => onSave(preferences)}>{t.save}</Button>
        </div>
      </div>
    </div>
  );
}
