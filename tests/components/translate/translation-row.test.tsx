import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TranslationRow } from "@/components/translate/translation-row";
import { copy } from "@/lib/workspace/copy";
import type { JobItem } from "@/components/translate/use-translation-wizard";

const t = copy.pl;

function makeItem(overrides: Partial<JobItem> = {}): JobItem {
  return {
    fileSlotId: "slot-1",
    invoiceId: "inv-1",
    invoiceNumber: "FA-2026-0001",
    status: "queued",
    creditConsumed: true,
    ...overrides
  };
}

describe("<TranslationRow>", () => {
  it("queued state renders 'w kolejce' with a muted dot", () => {
    render(
      <TranslationRow
        item={makeItem({ status: "queued" })}
        copy={t}
        onDownload={vi.fn()}
        onPreview={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText(/w kolejce/i)).toBeInTheDocument();
  });

  it("translating state renders the spinner + 'tłumaczę…'", () => {
    render(
      <TranslationRow
        item={makeItem({ status: "translating" })}
        copy={t}
        onDownload={vi.fn()}
        onPreview={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText(/tłumaczę/i)).toBeInTheDocument();
    expect(screen.getByTestId("row-spinner")).toBeInTheDocument();
  });

  it("done state shows duration + Preview + Download buttons", () => {
    render(
      <TranslationRow
        item={makeItem({ status: "done", durationMs: 12345 })}
        copy={t}
        onDownload={vi.fn()}
        onPreview={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText(/12 s/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Podgląd/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Pobierz/i })
    ).toBeInTheDocument();
  });

  it("done state with creditConsumed=false renders 'Z cache' badge", () => {
    render(
      <TranslationRow
        item={makeItem({ status: "done", creditConsumed: false })}
        copy={t}
        onDownload={vi.fn()}
        onPreview={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText(/Z cache/i)).toBeInTheDocument();
  });

  it("error state renders the message + Ponów (retry) button", () => {
    render(
      <TranslationRow
        item={makeItem({
          status: "error",
          errorMessage: "Translation failed"
        })}
        copy={t}
        onDownload={vi.fn()}
        onPreview={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText("Translation failed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ponów/i })
    ).toBeInTheDocument();
  });

  it("clicking Pobierz calls onDownload with the slot id", () => {
    const onDownload = vi.fn();
    render(
      <TranslationRow
        item={makeItem({ status: "done", fileSlotId: "slot-xyz" })}
        copy={t}
        onDownload={onDownload}
        onPreview={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Pobierz/i }));
    expect(onDownload).toHaveBeenCalledWith("slot-xyz");
  });

  it("clicking Ponów calls onRetry with the slot id", () => {
    const onRetry = vi.fn();
    render(
      <TranslationRow
        item={makeItem({
          status: "error",
          fileSlotId: "slot-fail",
          errorMessage: "boom"
        })}
        copy={t}
        onDownload={vi.fn()}
        onPreview={vi.fn()}
        onRetry={onRetry}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Ponów/i }));
    expect(onRetry).toHaveBeenCalledWith("slot-fail");
  });
});
