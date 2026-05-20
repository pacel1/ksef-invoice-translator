"use client";

import { useMemo } from "react";
import { TranslatorWizard } from "./translator-wizard";
import { createDefaultWizardApi } from "./default-wizard-api";
import type { UiLanguage } from "@/lib/workspace/copy";

export interface TranslatorWizardClientProps {
  uiLanguage: UiLanguage;
  initialBalance: number;
}

/**
 * Thin client wrapper that instantiates the production WizardApi (which
 * uses fetch) and forwards to the server-friendly <TranslatorWizard>.
 * Keeping fetch out of the orchestrator lets tests inject a stub api
 * without depending on the global fetch.
 */
export function TranslatorWizardClient({
  uiLanguage,
  initialBalance
}: TranslatorWizardClientProps) {
  const api = useMemo(() => createDefaultWizardApi(), []);
  return (
    <TranslatorWizard
      uiLanguage={uiLanguage}
      initialBalance={initialBalance}
      api={api}
    />
  );
}
