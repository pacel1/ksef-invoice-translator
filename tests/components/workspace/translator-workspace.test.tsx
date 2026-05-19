import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { TranslatorWorkspace } from "@/components/workspace/translator-workspace";
import type { UseTranslatorWorkflowResult } from "@/components/workspace/use-translator-workflow";
import type { Invoice } from "@/types/invoice";

let workflowState: UseTranslatorWorkflowResult;

vi.mock("@/components/workspace/use-translator-workflow", () => ({
  useTranslatorWorkflow: () => workflowState
}));

vi.mock("@/components/workspace/workspace-invoice-view", () => ({
  WorkspaceInvoiceView: () => <div data-testid="invoice-view" />
}));

vi.mock("@/components/workspace/workspace-empty-state", () => ({
  WorkspaceEmptyState: () => <div data-testid="empty-state" />
}));

vi.mock("@/components/workspace/insufficient-credit-modal", () => ({
  InsufficientCreditModal: () => null
}));

describe("<TranslatorWorkspace>", () => {
  it("retries auto-translate for the same language when a different invoice is loaded", async () => {
    const translateCurrent = vi.fn();
    workflowState = workflow({ invoiceId: "invoice-a", currentLanguage: "en", translateCurrent });

    const { rerender } = render(<TranslatorWorkspace />);
    await waitFor(() => expect(translateCurrent).toHaveBeenCalledTimes(1));

    workflowState = workflow({ invoiceId: "invoice-b", currentLanguage: "en", translateCurrent });
    rerender(<TranslatorWorkspace />);

    await waitFor(() => expect(translateCurrent).toHaveBeenCalledTimes(2));
  });

  it("does not auto-translate without an invoice id", async () => {
    const translateCurrent = vi.fn();
    workflowState = workflow({ invoiceId: null, currentLanguage: "en", translateCurrent });

    render(<TranslatorWorkspace />);
    await waitFor(() => expect(translateCurrent).not.toHaveBeenCalled());
  });
});

function workflow(overrides: Partial<UseTranslatorWorkflowResult> = {}): UseTranslatorWorkflowResult {
  const invoice: Invoice = {
    invoiceNumber: "FV/1",
    issueDate: "2026-05-19",
    currency: "PLN",
    seller: { name: "Seller" },
    buyer: { name: "Buyer" },
    items: [],
    totals: { net: 0, vat: 0, gross: 0 }
  };

  return {
    invoice,
    invoiceId: "invoice-a",
    status: "idle",
    messages: [],
    insufficientCredit: false,
    currentLanguage: "pl",
    bilingual: true,
    cachedLanguages: new Set(),
    previewPdfUrl: null,
    isPreparingPreview: false,
    setCurrentLanguage: vi.fn(),
    setBilingual: vi.fn(),
    upload: vi.fn(),
    loadSample: vi.fn(),
    translateCurrent: vi.fn(),
    downloadPdf: vi.fn(),
    dismissInsufficientCredit: vi.fn(),
    reset: vi.fn(),
    ...overrides
  };
}
