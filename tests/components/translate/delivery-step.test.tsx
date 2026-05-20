import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeliveryStep } from "@/components/translate/delivery-step";
import { copy } from "@/lib/workspace/copy";
import type {
  JobItem,
  WizardApi
} from "@/components/translate/use-translation-wizard";

const t = copy.pl;

function makeApi(): WizardApi {
  return {
    uploadBatch: vi.fn(),
    translate: vi.fn(),
    generatePdf: vi.fn(async () => new Blob(["pdf"], { type: "application/pdf" })),
    downloadZip: vi.fn(async () => new Blob(["zip"], { type: "application/zip" }))
  };
}

function makeItems(n: number, override: Partial<JobItem> = {}): JobItem[] {
  return Array.from({ length: n }, (_, i) => ({
    fileSlotId: `slot-${i + 1}`,
    invoiceId: `inv-${i + 1}`,
    invoiceNumber: `FA-2026-${String(i + 1).padStart(4, "0")}`,
    status: "done",
    creditConsumed: true,
    ...override
  }));
}

describe("<DeliveryStep>", () => {
  it("branches to single-mode when there is exactly 1 job item", () => {
    render(
      <DeliveryStep
        copy={t}
        api={makeApi()}
        jobItems={makeItems(1)}
        language="en"
        bilingual={false}
        onCancelBatch={vi.fn()}
        onResumeBatch={vi.fn(async () => undefined)}
        onRetryItem={vi.fn(async () => undefined)}
        onChangeLanguage={vi.fn()}
        onNewTranslation={vi.fn()}
      />
    );
    expect(screen.getByTestId("delivery-single")).toBeInTheDocument();
    expect(screen.queryByTestId("delivery-batch")).toBeNull();
  });

  it("branches to batch-mode when there are 2+ job items", () => {
    render(
      <DeliveryStep
        copy={t}
        api={makeApi()}
        jobItems={makeItems(3)}
        language="en"
        bilingual={false}
        onCancelBatch={vi.fn()}
        onResumeBatch={vi.fn(async () => undefined)}
        onRetryItem={vi.fn(async () => undefined)}
        onChangeLanguage={vi.fn()}
        onNewTranslation={vi.fn()}
      />
    );
    expect(screen.getByTestId("delivery-batch")).toBeInTheDocument();
    expect(screen.queryByTestId("delivery-single")).toBeNull();
  });

  it("batch mode shows a progress bar with done/total count", () => {
    const items = makeItems(3);
    items[0].status = "done";
    items[1].status = "translating";
    items[2].status = "queued";
    render(
      <DeliveryStep
        copy={t}
        api={makeApi()}
        jobItems={items}
        language="en"
        bilingual={false}
        onCancelBatch={vi.fn()}
        onResumeBatch={vi.fn(async () => undefined)}
        onRetryItem={vi.fn(async () => undefined)}
        onChangeLanguage={vi.fn()}
        onNewTranslation={vi.fn()}
      />
    );
    expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument();
  });

  it("batch mode shows Stop while items are in-flight", () => {
    const items = makeItems(3);
    items[0].status = "translating";
    render(
      <DeliveryStep
        copy={t}
        api={makeApi()}
        jobItems={items}
        language="en"
        bilingual={false}
        onCancelBatch={vi.fn()}
        onResumeBatch={vi.fn(async () => undefined)}
        onRetryItem={vi.fn(async () => undefined)}
        onChangeLanguage={vi.fn()}
        onNewTranslation={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /Zatrzymaj/i })
    ).toBeInTheDocument();
  });

  it("batch mode shows Resume after cancellation (all non-done items in error)", () => {
    const items = makeItems(3);
    items[0].status = "done";
    items[1].status = "error";
    items[1].errorMessage = "Anulowano przez użytkownika";
    items[2].status = "error";
    items[2].errorMessage = "Anulowano przez użytkownika";

    render(
      <DeliveryStep
        copy={t}
        api={makeApi()}
        jobItems={items}
        language="en"
        bilingual={false}
        onCancelBatch={vi.fn()}
        onResumeBatch={vi.fn(async () => undefined)}
        onRetryItem={vi.fn(async () => undefined)}
        onChangeLanguage={vi.fn()}
        onNewTranslation={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /Wznów/i })
    ).toBeInTheDocument();
  });

  it("batch download-all button is disabled when zero items are done", () => {
    const items = makeItems(3);
    items.forEach((item) => (item.status = "queued"));
    render(
      <DeliveryStep
        copy={t}
        api={makeApi()}
        jobItems={items}
        language="en"
        bilingual={false}
        onCancelBatch={vi.fn()}
        onResumeBatch={vi.fn(async () => undefined)}
        onRetryItem={vi.fn(async () => undefined)}
        onChangeLanguage={vi.fn()}
        onNewTranslation={vi.fn()}
      />
    );
    const zipBtn = screen.getByRole("button", { name: /Pobierz wszystkie/i });
    expect(zipBtn).toBeDisabled();
  });

  it("invokes onNewTranslation when the user clicks 'Nowe tłumaczenie'", () => {
    const onNewTranslation = vi.fn();
    render(
      <DeliveryStep
        copy={t}
        api={makeApi()}
        jobItems={makeItems(1)}
        language="en"
        bilingual={false}
        onCancelBatch={vi.fn()}
        onResumeBatch={vi.fn(async () => undefined)}
        onRetryItem={vi.fn(async () => undefined)}
        onChangeLanguage={vi.fn()}
        onNewTranslation={onNewTranslation}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Nowe tłumaczenie/i })
    );
    expect(onNewTranslation).toHaveBeenCalledTimes(1);
  });
});
