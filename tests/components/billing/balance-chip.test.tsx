import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BalanceChip } from "@/components/billing/balance-chip";

describe("<BalanceChip>", () => {
  const baseProps = {
    freeLabel: "Free credit",
    paidLabel: "credits",
    topUpLabel: "Top up",
    outOfCreditsLabel: "Out of credits"
  };

  it("renders as a link to /billing", () => {
    render(<BalanceChip initialFree={1} initialPaid={5} {...baseProps} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/billing");
  });

  it("shows the balance in the default state", () => {
    render(<BalanceChip initialFree={1} initialPaid={5} {...baseProps} />);
    expect(screen.getByText(/1 free credit/i)).toBeInTheDocument();
    expect(screen.getByText(/5 credits/i)).toBeInTheDocument();
  });

  it("shows the zero-balance variant when both balances are 0", () => {
    render(<BalanceChip initialFree={0} initialPaid={0} {...baseProps} />);
    expect(screen.getByText(/Out of credits/i)).toBeInTheDocument();
    expect(screen.queryByText(/0 free credit/i)).not.toBeInTheDocument();
  });

  it("includes an accessible label naming the action", () => {
    render(<BalanceChip initialFree={1} initialPaid={5} {...baseProps} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("aria-label")).toMatch(/Top up/i);
  });
});
