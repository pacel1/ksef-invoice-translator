"use client";

import type { Copy } from "@/lib/workspace/copy";
import type {
  FileSlot,
  WizardApi
} from "./use-translation-wizard";

export interface UploadStepProps {
  files: ReadonlyArray<FileSlot>;
  copy: Copy;
  onAddFiles: (files: ReadonlyArray<File>) => Promise<void>;
  onRemoveFile: (localId: string) => void;
  onClearAll: () => void;
  onNext: () => void;
}

/**
 * Step 1 stub — full implementation lands in PR #B Task 2.4.
 * For now this exists so the orchestrator can render the route and
 * the wizard state machine flows through.
 */
export function UploadStep(props: UploadStepProps) {
  void props;
  return <div data-testid="wizard-step-upload" />;
}

// Re-export for the orchestrator's type-only imports.
export type { WizardApi };
