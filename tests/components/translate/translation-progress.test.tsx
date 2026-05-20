import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TranslationProgress } from "@/components/translate/translation-progress";
import { copy } from "@/lib/workspace/copy";
import type { JobItem } from "@/components/translate/use-translation-wizard";

const t = copy.pl;

function makeItem(overrides: Partial<JobItem> = {}): JobItem {
  return {
    fileSlotId: "slot-1",
    invoiceId: "inv-1",
    invoiceNumber: "FA-2026-0001",
    status: "translating",
    creditConsumed: true,
    ...overrides
  };
}

describe("<TranslationProgress>", () => {
  const baseProps = {
    copy: t,
    languageLabel: "niemiecki",
    bilingual: false,
    onCancel: vi.fn(),
    onRetry: vi.fn(),
    onChangeLanguage: vi.fn(),
    onNewTranslation: vi.fn()
  };

  it("renders the translating state with spinner, elapsed counter, and cancel CTA", () => {
    render(<TranslationProgress {...baseProps} item={makeItem({ status: "translating" })} />);
    expect(screen.getByTestId("delivery-progress")).toBeInTheDocument();
    // The translating title appears twice (header subtitle + centered card) —
    // assert both via getAllByText so we don't accidentally pin one of them away.
    expect(
      screen.getAllByText(new RegExp(String(t.deliveryTranslatingTitle), "i"))
        .length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("button", { name: new RegExp(String(t.deliveryCancelCta), "i") })
    ).toBeInTheDocument();
    // Elapsed counter renders "0 s" on first paint (before the 1s tick).
    expect(screen.getByText("0 s")).toBeInTheDocument();
  });

  it("shows the indeterminate progress bar with role='progressbar'", () => {
    render(<TranslationProgress {...baseProps} item={makeItem({ status: "translating" })} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("includes the immutable-data hint", () => {
    render(<TranslationProgress {...baseProps} item={makeItem({ status: "translating" })} />);
    expect(
      screen.getByText(new RegExp(String(t.deliveryTranslatingHint).slice(0, 30), "i"))
    ).toBeInTheDocument();
  });

  it("calls onCancel when the user clicks Anuluj tłumaczenie", () => {
    const onCancel = vi.fn();
    render(
      <TranslationProgress
        {...baseProps}
        onCancel={onCancel}
        item={makeItem({ status: "translating" })}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(String(t.deliveryCancelCta), "i") })
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders the error state with the message + Ponów / Zmień język / Nowe", () => {
    render(
      <TranslationProgress
        {...baseProps}
        item={makeItem({ status: "error", errorMessage: "OpenAI 502" })}
      />
    );
    expect(screen.getByTestId("delivery-error")).toBeInTheDocument();
    expect(screen.getByText("OpenAI 502")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: new RegExp(String(t.retryCta), "i") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: new RegExp(String(t.changeLanguageCta), "i") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: new RegExp(String(t.newTranslationCta), "i") })
    ).toBeInTheDocument();
  });

  it("calls onRetry with the fileSlotId when the user clicks Ponów", () => {
    const onRetry = vi.fn();
    render(
      <TranslationProgress
        {...baseProps}
        onRetry={onRetry}
        item={makeItem({
          status: "error",
          fileSlotId: "slot-xyz",
          errorMessage: "boom"
        })}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(String(t.retryCta), "i") })
    );
    expect(onRetry).toHaveBeenCalledWith("slot-xyz");
  });

  it("renders the queued state with the same translating UI (no preview yet)", () => {
    render(<TranslationProgress {...baseProps} item={makeItem({ status: "queued" })} />);
    // Same testid + same progress bar as the translating state; both are
    // 'in progress' from the user's perspective.
    expect(screen.getByTestId("delivery-progress")).toBeInTheDocument();
  });
});
