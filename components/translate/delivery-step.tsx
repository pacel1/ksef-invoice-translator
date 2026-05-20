"use client";

import type { Copy } from "@/lib/workspace/copy";
import type { LanguageCode } from "@/types/invoice";
import type {
  JobItem,
  WizardApi
} from "./use-translation-wizard";

export interface DeliveryStepProps {
  copy: Copy;
  api: WizardApi;
  jobItems: ReadonlyArray<JobItem>;
  language: LanguageCode;
  bilingual: boolean;
  onCancelBatch: () => void;
  onResumeBatch: () => Promise<void>;
  onRetryItem: (fileSlotId: string) => Promise<void>;
  onChangeLanguage: () => void;
  onNewTranslation: () => void;
}

/**
 * Step 3 stub — full implementation lands in PR #B Task 2.6.
 * Branches into <DeliverySingle> (N=1) vs <DeliveryBatch> (N>1).
 */
export function DeliveryStep(props: DeliveryStepProps) {
  void props;
  return <div data-testid="wizard-step-delivery" />;
}
