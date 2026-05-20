"use client";

import { useMemo } from "react";
import { Stepper, type StepperStep } from "@/components/ui/stepper";
import { copy, type UiLanguage } from "@/lib/workspace/copy";
import { useTranslationWizard, type WizardApi, type WizardState } from "./use-translation-wizard";
import { UploadStep } from "./upload-step";
import { LanguageStep } from "./language-step";
import { DeliveryStep } from "./delivery-step";
import type { LanguageCode } from "@/types/invoice";

export interface TranslatorWizardProps {
  /** UI locale — drives the copy dictionary used by step children. */
  uiLanguage?: UiLanguage;
  /** Snapshot of the user's credit balance at page-render time. */
  initialBalance: number;
  /** API wiring. Defaults to the real fetch-based impl in production. */
  api: WizardApi;
  /** Optional hydration — used by /translate?invoiceId=… */
  initialState?: Partial<WizardState>;
}

/**
 * Orchestrator: composes Stepper + the active step pane. Owns no
 * business logic — every state transition flows through the wizard
 * hook so tests can verify it independently.
 */
export function TranslatorWizard({
  uiLanguage = "pl",
  initialBalance,
  api,
  initialState
}: TranslatorWizardProps) {
  const t = copy[uiLanguage];
  const wizard = useTranslationWizard({ api, initialState });

  const steps: ReadonlyArray<StepperStep> = useMemo(
    () => [
      { id: "upload", label: String(t.wizardStepUpload) },
      { id: "language", label: String(t.wizardStepLanguage) },
      { id: "delivery", label: String(t.wizardStepDelivery) }
    ],
    [t.wizardStepUpload, t.wizardStepLanguage, t.wizardStepDelivery]
  );

  const completedIds = useMemo(() => {
    const completed = new Set<string>();
    if (wizard.state.step === "language" || wizard.state.step === "delivery") {
      completed.add("upload");
    }
    if (wizard.state.step === "delivery") {
      completed.add("language");
    }
    return completed;
  }, [wizard.state.step]);

  function handleJumpBack(stepId: string) {
    if (stepId === "upload" && wizard.state.step !== "upload") {
      // Walk back step-by-step so internal cleanup (e.g. drop jobItems
      // when leaving delivery) runs on each transition.
      if (wizard.state.step === "delivery") wizard.goBack();
      wizard.goBack();
    } else if (stepId === "language" && wizard.state.step === "delivery") {
      wizard.goBack();
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <Stepper
        steps={steps}
        current={wizard.state.step}
        completedIds={completedIds}
        onJumpBack={handleJumpBack}
        ariaLabel={String(t.wizardProgressLabel)}
      />

      {wizard.state.step === "upload" ? (
        <UploadStep
          files={wizard.state.files}
          copy={t}
          onAddFiles={wizard.addFiles}
          onRemoveFile={wizard.removeFile}
          onClearAll={wizard.clearAll}
          onNext={wizard.goNext}
        />
      ) : null}

      {wizard.state.step === "language" ? (
        <LanguageStep
          uiLanguage={uiLanguage}
          copy={t}
          language={wizard.state.language}
          bilingual={wizard.state.bilingual}
          cost={wizard.cost}
          balance={initialBalance}
          onSetLanguage={wizard.setLanguage}
          onSetBilingual={wizard.setBilingual}
          onBack={wizard.goBack}
          onTranslate={wizard.startTranslation}
        />
      ) : null}

      {wizard.state.step === "delivery" ? (
        <DeliveryStep
          copy={t}
          api={api}
          jobItems={wizard.state.jobItems}
          language={(wizard.state.language ?? "en") as LanguageCode}
          bilingual={wizard.state.bilingual}
          onCancelBatch={wizard.cancelBatch}
          onResumeBatch={wizard.resumeBatch}
          onRetryItem={wizard.retryItem}
          onChangeLanguage={wizard.goBack}
          onNewTranslation={wizard.reset}
        />
      ) : null}
    </section>
  );
}
