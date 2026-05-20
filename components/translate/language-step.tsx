"use client";

import type { Copy } from "@/lib/workspace/copy";
import type { LanguageCode } from "@/types/invoice";

export interface LanguageStepProps {
  uiLanguage: "pl" | "en";
  copy: Copy;
  language: LanguageCode | null;
  bilingual: boolean;
  cost: number;
  balance: number;
  onSetLanguage: (code: LanguageCode) => void;
  onSetBilingual: (value: boolean) => void;
  onBack: () => void;
  onTranslate: () => Promise<void>;
}

/**
 * Step 2 stub — full implementation lands in PR #B Task 2.5.
 */
export function LanguageStep(props: LanguageStepProps) {
  void props;
  return <div data-testid="wizard-step-language" />;
}
