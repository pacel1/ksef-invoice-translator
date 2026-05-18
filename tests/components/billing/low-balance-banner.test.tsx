import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LowBalanceBanner } from "@/components/billing/low-balance-banner";

const baseProps = {
  initialFree: 0,
  initialPaid: 0,
  title: "Out of credits",
  body: "Buy a pack to upload another invoice.",
  buyLabel: "Buy credits",
  closeLabel: "Close"
};

beforeEach(() => {
  // jsdom provides sessionStorage; reset it between tests.
  sessionStorage.clear();
});

describe("<LowBalanceBanner>", () => {
  it("renders when both balances are zero", () => {
    render(<LowBalanceBanner {...baseProps} />);
    expect(screen.getByText("Out of credits")).toBeInTheDocument();
  });

  it("renders nothing when balance is non-zero", () => {
    const { container } = render(
      <LowBalanceBanner {...baseProps} initialFree={1} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("has a buy-credits button that dispatches open-credit-drawer", () => {
    const dispatch = vi.fn();
    const original = window.dispatchEvent;
    window.dispatchEvent = dispatch as typeof window.dispatchEvent;
    render(<LowBalanceBanner {...baseProps} />);
    const button = screen.getByRole("button", { name: /Buy credits/i });
    fireEvent.click(button);
    expect(dispatch).toHaveBeenCalled();
    const event = dispatch.mock.calls.find(
      ([e]) => (e as CustomEvent).type === "open-credit-drawer"
    );
    expect(event).toBeDefined();
    window.dispatchEvent = original;
  });

  it("dismisses on close click and remembers via sessionStorage", () => {
    const { container, rerender } = render(<LowBalanceBanner {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    expect(container).toBeEmptyDOMElement();

    rerender(<LowBalanceBanner {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("re-appears after sessionStorage is cleared (new session)", () => {
    render(<LowBalanceBanner {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    sessionStorage.clear();
    const { container } = render(<LowBalanceBanner {...baseProps} />);
    expect(container).not.toBeEmptyDOMElement();
  });
});
