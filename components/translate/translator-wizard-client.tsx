"use client";

import { useMemo } from "react";
import { TranslatorWizard } from "./translator-wizard";
import { createDefaultWizardApi } from "./default-wizard-api";
import type {
  FileSlot,
  JobItem,
  WizardState
} from "./use-translation-wizard";
import type { UiLanguage } from "@/lib/workspace/copy";
import type { PreloadedInvoice } from "@/lib/invoice/preloaded-invoice";

export interface TranslatorWizardClientProps {
  uiLanguage: UiLanguage;
  initialBalance: number;
  /**
   * Set when the user landed via /translate?invoiceId=<uuid>. We hydrate
   * the wizard state into Step 3 (cached translation exists) or Step 2
   * (no translation yet) so they skip the upload flow entirely.
   */
  preloaded?: PreloadedInvoice | null;
}

/**
 * Client wrapper that instantiates the production WizardApi (which
 * uses fetch) and forwards to <TranslatorWizard>. Keeping fetch out
 * of the orchestrator lets tests inject a stub api.
 */
export function TranslatorWizardClient({
  uiLanguage,
  initialBalance,
  preloaded
}: TranslatorWizardClientProps) {
  const api = useMemo(() => createDefaultWizardApi(), []);
  const initialState = useMemo(
    () => buildInitialState(preloaded),
    [preloaded]
  );

  return (
    <TranslatorWizard
      uiLanguage={uiLanguage}
      initialBalance={initialBalance}
      api={api}
      initialState={initialState}
    />
  );
}

/**
 * Translates a `PreloadedInvoice` into the right wizard initial state.
 *
 *   no preloaded data            → undefined (wizard starts fresh on Step 1)
 *   preloaded, has translation   → Step 3 with one done JobItem
 *   preloaded, no translation    → Step 2 with one ready FileSlot
 *
 * The FileSlot needs a `File` object even though we never re-upload —
 * the type forces it. We synthesize an empty File whose name matches the
 * invoice number so the UI shows something sensible if the user navigates
 * back to Step 1.
 */
function buildInitialState(
  preloaded: PreloadedInvoice | null | undefined
): Partial<WizardState> | undefined {
  if (!preloaded) return undefined;

  const fileSlot: FileSlot = {
    localId: `preloaded-${preloaded.invoiceId}`,
    file: new File([], `${preloaded.invoiceNumber ?? "invoice"}.xml`, {
      type: "application/xml"
    }),
    status: "ready",
    invoiceId: preloaded.invoiceId,
    invoiceNumber: preloaded.invoiceNumber ?? undefined
  };

  if (!preloaded.translation) {
    // No translation yet — drop into Step 2 with the file ready, user
    // picks language.
    return {
      step: "language",
      files: [fileSlot],
      language: null,
      bilingual: false,
      jobItems: []
    };
  }

  // Translation exists — jump straight to delivery so the user sees the
  // PDF preview. creditConsumed=false because no new spend is happening
  // (the original consume row already exists in credit_ledger).
  const jobItem: JobItem = {
    fileSlotId: fileSlot.localId,
    invoiceId: preloaded.invoiceId,
    invoiceNumber: preloaded.invoiceNumber ?? "",
    status: "done",
    creditConsumed: false
  };
  return {
    step: "delivery",
    files: [fileSlot],
    language: preloaded.translation.language,
    bilingual: preloaded.translation.bilingual,
    jobItems: [jobItem]
  };
}
