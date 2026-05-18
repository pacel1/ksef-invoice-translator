import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreditBalanceBand } from "@/components/billing/credit-balance-band";

const labels = {
  paidLabel: "kredytów",
  freeLabel: "darmowy w tym miesiącu",
  nextFreeLabel: "Następne darmowe odnowienie:"
};

describe("<CreditBalanceBand>", () => {
  it("renders the paid balance as a big tabular number", () => {
    render(
      <CreditBalanceBand
        paidCredits={25}
        freeCreditsRemaining={1}
        nextFreeAt="2026-06-01"
        labels={labels}
      />
    );
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText(/kredytów/i)).toBeInTheDocument();
  });

  it("renders the free credit sub-row when free credit is remaining", () => {
    render(
      <CreditBalanceBand
        paidCredits={25}
        freeCreditsRemaining={1}
        nextFreeAt="2026-06-01"
        labels={labels}
      />
    );
    expect(screen.getByText(/1\s+darmowy w tym miesiącu/i)).toBeInTheDocument();
  });

  it("renders the next-free refresh date", () => {
    render(
      <CreditBalanceBand
        paidCredits={25}
        freeCreditsRemaining={0}
        nextFreeAt="2026-06-01"
        labels={labels}
      />
    );
    expect(screen.getByText(/Następne darmowe odnowienie/i)).toBeInTheDocument();
    expect(screen.getByText(/2026-06-01/)).toBeInTheDocument();
  });

  it("renders 0 paid credits clearly (not blank)", () => {
    render(
      <CreditBalanceBand
        paidCredits={0}
        freeCreditsRemaining={0}
        nextFreeAt="2026-06-01"
        labels={labels}
      />
    );
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
