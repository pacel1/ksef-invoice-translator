import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LowBalanceBanner } from "@/components/billing/low-balance-banner";

const baseProps = {
  initialFree: 0,
  initialPaid: 0,
  title: "Out of credits",
  body: "Buy a pack to upload another invoice.",
  buyLabel: "Buy credits"
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

  it("has a buy-credits link pointing at /billing", () => {
    render(<LowBalanceBanner {...baseProps} />);
    const link = screen.getByRole("link", { name: /Buy credits/i });
    expect(link).toHaveAttribute("href", "/billing");
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
