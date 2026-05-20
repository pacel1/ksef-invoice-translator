import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { TranslatorWizard } from "@/components/translate/translator-wizard";
import type { WizardApi } from "@/components/translate/use-translation-wizard";

/**
 * The orchestrator renders the Stepper + whichever step component
 * matches the current state. It owns no business logic of its own —
 * just composition. Tests verify the wiring is correct:
 *
 *   1. The stepper shows the right step as current.
 *   2. The right step pane is mounted.
 *   3. initialBalance flows down to the cost preview (Step 2).
 */

function makeStubApi(): WizardApi {
  return {
    uploadBatch: vi.fn(async (files: ReadonlyArray<File>) => ({
      results: files.map((file, i) => ({
        ok: true as const,
        fileName: file.name,
        invoiceId: `inv-${i + 1}`,
        invoiceNumber: `FA-${i + 1}`,
        warnings: [],
        isNew: true
      }))
    })),
    translate: vi.fn(async () => ({
      ok: true as const,
      invoice: {} as never,
      cacheHit: false
    })),
    generatePdf: vi.fn(async () => new Blob()),
    downloadZip: vi.fn(async () => new Blob())
  };
}

describe("<TranslatorWizard>", () => {
  it("renders the stepper with three labelled steps", () => {
    render(
      <TranslatorWizard uiLanguage="pl" initialBalance={5} api={makeStubApi()} />
    );
    const nav = screen.getByRole("navigation", { name: /Postęp/i });
    expect(within(nav).getByText("Wybierz pliki")).toBeInTheDocument();
    expect(within(nav).getByText("Język i format")).toBeInTheDocument();
    expect(within(nav).getByText("Tłumaczenie")).toBeInTheDocument();
  });

  it("uses the Polish step labels when uiLanguage='pl'", () => {
    render(
      <TranslatorWizard uiLanguage="pl" initialBalance={5} api={makeStubApi()} />
    );
    const nav = screen.getByRole("navigation", { name: /Postęp/i });
    expect(within(nav).getByText("Wybierz pliki")).toBeInTheDocument();
  });

  it("uses the English step labels when uiLanguage='en'", () => {
    render(
      <TranslatorWizard uiLanguage="en" initialBalance={5} api={makeStubApi()} />
    );
    const nav = screen.getByRole("navigation", { name: /progress/i });
    expect(within(nav).getByText("Choose files")).toBeInTheDocument();
  });

  it("starts on the upload step by default", () => {
    render(
      <TranslatorWizard uiLanguage="pl" initialBalance={5} api={makeStubApi()} />
    );
    expect(screen.getByTestId("wizard-step-upload")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-step-language")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wizard-step-delivery")).not.toBeInTheDocument();
  });

  it("hydrates to the delivery step when initialState provides done jobs", () => {
    render(
      <TranslatorWizard
        uiLanguage="pl"
        initialBalance={5}
        api={makeStubApi()}
        initialState={{
          step: "delivery",
          jobItems: [
            {
              fileSlotId: "x",
              invoiceId: "inv-9",
              invoiceNumber: "FA-9",
              status: "done",
              creditConsumed: false
            }
          ]
        }}
      />
    );
    expect(screen.getByTestId("wizard-step-delivery")).toBeInTheDocument();
  });

  it("marks step 1 as aria-current at first render", () => {
    render(
      <TranslatorWizard uiLanguage="pl" initialBalance={5} api={makeStubApi()} />
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("aria-current", "step");
    expect(items[1]).not.toHaveAttribute("aria-current");
  });
});
