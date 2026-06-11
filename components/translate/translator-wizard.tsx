"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Stepper, type StepperStep } from "@/components/ui/stepper";
import { copy, type UiLanguage } from "@/lib/workspace/copy";
import { NameCaptureModal } from "@/components/account/name-capture-modal";
import { useTranslationWizard, type WizardApi, type WizardState } from "./use-translation-wizard";
import { UploadStep } from "./upload-step";
import { LanguageStep } from "./language-step";
import { DeliveryStep } from "./delivery-step";
import type { LanguageCode } from "@/types/invoice";

export interface ReviewerSnapshot {
  firstName: string | null;
  lastName: string | null;
}

export interface TranslatorWizardProps {
  /** UI locale — drives the copy dictionary used by step children. */
  uiLanguage?: UiLanguage;
  /** Snapshot of the user's credit balance at page-render time. */
  initialBalance: number;
  /** API wiring. Defaults to the real fetch-based impl in production. */
  api: WizardApi;
  /** Optional hydration — used by /translate?invoiceId=… */
  initialState?: Partial<WizardState>;
  /**
   * Optional side-effect that runs AFTER `wizard.reset()` when the user
   * clicks "+ Nowe Tłumaczenie". The client wrapper uses this to wipe
   * the `?invoiceId=…` deep-link from the URL so a subsequent re-mount
   * can't re-hydrate the wizard into the previous invoice.
   */
  onAfterReset?: () => void;
  /**
   * The user's current first/last name (from profiles). If either half
   * is missing, the wizard hard-blocks the Translate click with a modal
   * — MF requires the reviewer name on every translated invoice.
   */
  reviewer?: ReviewerSnapshot;
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
  initialState,
  onAfterReset,
  reviewer
}: TranslatorWizardProps) {
  const t = copy[uiLanguage];
  const wizard = useTranslationWizard({ api, initialState });

  // Reviewer-name hard block: if MF-required first/last name is missing
  // when the user clicks Translate, open the modal and stash the action
  // so we can resume it the moment the name lands in the database.
  //
  // Derived from the prop on every render (not snapshotted into state at
  // mount): when a brand-new user saves their name through the layout's
  // soft onboarding modal, updateProfile → revalidatePath("/translate")
  // refreshes this prop on the already-mounted wizard, and the first
  // Translate click must not re-prompt. `reviewerSavedHere` covers the
  // wizard's own modal, whose save lands before the prop refresh.
  const reviewerOnFile = Boolean(
    reviewer?.firstName?.trim() && reviewer?.lastName?.trim()
  );
  const [reviewerSavedHere, setReviewerSavedHere] = useState(false);
  const reviewerSatisfied = reviewerOnFile || reviewerSavedHere;
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const retryAfterSaveRef = useRef<null | (() => void)>(null);

  const handleTranslate = useCallback(async () => {
    if (!reviewerSatisfied) {
      retryAfterSaveRef.current = () => {
        void wizard.startTranslation();
      };
      setNameModalOpen(true);
      return;
    }
    await wizard.startTranslation();
  }, [reviewerSatisfied, wizard]);

  function handleNameSaved() {
    setReviewerSavedHere(true);
    const retry = retryAfterSaveRef.current;
    retryAfterSaveRef.current = null;
    if (retry) retry();
  }

  function handleNewTranslation() {
    wizard.reset();
    onAfterReset?.();
  }

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
          onTranslate={handleTranslate}
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
          onNewTranslation={handleNewTranslation}
        />
      ) : null}

      <NameCaptureModal
        open={nameModalOpen}
        dismissible={false}
        initialFirstName={reviewer?.firstName ?? ""}
        initialLastName={reviewer?.lastName ?? ""}
        labels={{
          title: String(t.nameCaptureTitle),
          body: String(t.nameCaptureBody),
          firstNameLabel: String(t.nameCaptureFirstNameLabel),
          lastNameLabel: String(t.nameCaptureLastNameLabel),
          saveButton: String(t.nameCaptureSave),
          savingButton: String(t.nameCaptureSaving),
          errorMessage: String(t.nameCaptureError)
        }}
        onClose={() => {
          setNameModalOpen(false);
          retryAfterSaveRef.current = null;
        }}
        onSaved={handleNameSaved}
      />
    </section>
  );
}
