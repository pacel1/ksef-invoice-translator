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

  it("clicking '+ Nowe Tłumaczenie' on delivery snaps back to a clean upload step", () => {
    // Hydrate straight into the delivery step with one done invoice so the
    // "+ Nowe Tłumaczenie" CTA is reachable. After the click the wizard
    // must return to step 1 with NO file rows still showing — this is the
    // regression Fix #2 protects against (state.files were "stuck" after
    // hydrated-from-URL deep-links).
    render(
      <TranslatorWizard
        uiLanguage="pl"
        initialBalance={5}
        api={makeStubApi()}
        initialState={{
          step: "delivery",
          files: [
            {
              localId: "preloaded-1",
              file: new File([], "FA-9.xml", { type: "application/xml" }),
              status: "ready",
              invoiceId: "inv-9",
              invoiceNumber: "FA-9"
            }
          ],
          language: "en",
          bilingual: false,
          jobItems: [
            {
              fileSlotId: "preloaded-1",
              invoiceId: "inv-9",
              invoiceNumber: "FA-9",
              status: "done",
              creditConsumed: false
            }
          ]
        }}
      />
    );
    // Sanity — we start on delivery
    expect(screen.getByTestId("wizard-step-delivery")).toBeInTheDocument();

    // Click "+ Nowe tłumaczenie" (the single-mode variant since there is 1 done item)
    const newBtn = screen.getByRole("button", { name: /Nowe tłumaczenie/i });
    act(() => {
      fireEvent.click(newBtn);
    });

    // Back on Step 1 with no lingering file rows
    expect(screen.getByTestId("wizard-step-upload")).toBeInTheDocument();
    expect(screen.queryByTestId("upload-file-list")).toBeNull();
  });

  it("opens the hard-block name modal when the user clicks Translate without a reviewer name", async () => {
    // Hydrate straight into Step 2 with a single ready file + a chosen
    // language, so the Translate CTA is visible and one click is enough
    // to trigger the gate.
    render(
      <TranslatorWizard
        uiLanguage="pl"
        initialBalance={5}
        api={makeStubApi()}
        reviewer={{ firstName: null, lastName: null }}
        initialState={{
          step: "language",
          files: [
            {
              localId: "slot-1",
              file: new File([], "f.xml", { type: "application/xml" }),
              status: "ready",
              invoiceId: "inv-1",
              invoiceNumber: "FA-1"
            }
          ],
          language: "en",
          bilingual: false,
          jobItems: []
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Tłumacz/i }));
    expect(
      await screen.findByRole("dialog", {
        name: /Imię i nazwisko zatwierdzającego tłumaczenie/i
      })
    ).toBeInTheDocument();
  });

  it("does NOT open the hard-block modal when first+last name are already set", () => {
    render(
      <TranslatorWizard
        uiLanguage="pl"
        initialBalance={5}
        api={makeStubApi()}
        reviewer={{ firstName: "Jan", lastName: "Kowalski" }}
        initialState={{
          step: "language",
          files: [
            {
              localId: "slot-1",
              file: new File([], "f.xml", { type: "application/xml" }),
              status: "ready",
              invoiceId: "inv-1",
              invoiceNumber: "FA-1"
            }
          ],
          language: "en",
          bilingual: false,
          jobItems: []
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Tłumacz/i }));
    expect(
      screen.queryByRole("dialog", {
        name: /Imię i nazwisko zatwierdzającego tłumaczenie/i
      })
    ).toBeNull();
  });

  it("does NOT open the hard-block modal when the reviewer name arrives via a prop refresh after mount", () => {
    // Regression: a brand-new user mounts the wizard while first/last name
    // are still NULL (the layout's soft onboarding modal is open on top).
    // Saving the name there runs updateProfile → revalidatePath("/translate"),
    // which re-renders the page and delivers a fresh `reviewer` prop to the
    // already-mounted wizard. The first Translate click must honour that
    // refreshed prop instead of the mount-time snapshot — otherwise the
    // user gets prompted for their name a second time.
    const initialState = {
      step: "language" as const,
      files: [
        {
          localId: "slot-1",
          file: new File([], "f.xml", { type: "application/xml" }),
          status: "ready" as const,
          invoiceId: "inv-1",
          invoiceNumber: "FA-1"
        }
      ],
      language: "en" as const,
      bilingual: false,
      jobItems: []
    };
    const api = makeStubApi();
    const { rerender } = render(
      <TranslatorWizard
        uiLanguage="pl"
        initialBalance={5}
        api={api}
        reviewer={{ firstName: null, lastName: null }}
        initialState={initialState}
      />
    );

    // The soft onboarding modal saved the name; the RSC refresh hands the
    // wizard an updated reviewer prop without remounting it.
    rerender(
      <TranslatorWizard
        uiLanguage="pl"
        initialBalance={5}
        api={api}
        reviewer={{ firstName: "Jan", lastName: "Kowalski" }}
        initialState={initialState}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Tłumacz/i }));
    expect(
      screen.queryByRole("dialog", {
        name: /Imię i nazwisko zatwierdzającego tłumaczenie/i
      })
    ).toBeNull();
  });

  it("invokes onAfterReset when the user starts a new translation from delivery", () => {
    // Allows the client wrapper to clean a deep-link URL (?invoiceId=…) so
    // a subsequent re-mount cannot re-hydrate the wizard into the old
    // preloaded invoice.
    const onAfterReset = vi.fn();
    render(
      <TranslatorWizard
        uiLanguage="pl"
        initialBalance={5}
        api={makeStubApi()}
        onAfterReset={onAfterReset}
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

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Nowe tłumaczenie/i }));
    });

    expect(onAfterReset).toHaveBeenCalledTimes(1);
  });
});
