import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { CostPreview } from "@/components/translate/cost-preview";

describe("<CostPreview>", () => {
  it("renders cost, balance and after rows", () => {
    render(
      <CostPreview
        cost={3}
        initialBalance={10}
        labels={{ cost: "Koszt", balance: "Stan", after: "Po", credits: "kredytów" }}
      />
    );
    expect(screen.getByText("Koszt")).toBeInTheDocument();
    expect(screen.getByText("Stan")).toBeInTheDocument();
    expect(screen.getByText("Po")).toBeInTheDocument();
    expect(screen.getByText(/3 kredytów/)).toBeInTheDocument();
    expect(screen.getByText(/10 kredytów/)).toBeInTheDocument();
    expect(screen.getByText(/7 kredytów/)).toBeInTheDocument();
  });

  it("uses singular form when the value is exactly 1", () => {
    render(
      <CostPreview
        cost={1}
        initialBalance={5}
        labels={{
          cost: "Koszt",
          balance: "Stan",
          after: "Po",
          credits: "kredytów",
          creditSingular: "kredyt"
        }}
      />
    );
    expect(screen.getByText(/^1 kredyt$/)).toBeInTheDocument();
  });

  it("flips to insufficient styling when balance < cost", () => {
    render(
      <CostPreview
        cost={10}
        initialBalance={3}
        labels={{ cost: "Koszt", balance: "Stan", after: "Po", credits: "kredytów" }}
      />
    );
    const card = screen.getByTestId("cost-preview");
    expect(card.className).toMatch(/border-danger|bg-danger/);
  });

  it("reacts to the credit-balance-changed window event", () => {
    render(
      <CostPreview
        cost={2}
        initialBalance={5}
        labels={{ cost: "Koszt", balance: "Stan", after: "Po", credits: "kredytów" }}
      />
    );
    expect(screen.getByText(/5 kredytów/)).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("credit-balance-changed", { detail: { total: 12 } })
      );
    });

    expect(screen.getByText(/12 kredytów/)).toBeInTheDocument();
  });

  it("uses aria-live='polite' so screen readers announce balance changes", () => {
    render(
      <CostPreview
        cost={1}
        initialBalance={5}
        labels={{ cost: "Koszt", balance: "Stan", after: "Po", credits: "kredytów" }}
      />
    );
    const card = screen.getByTestId("cost-preview");
    expect(card).toHaveAttribute("aria-live", "polite");
  });
});
