import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingTeaser } from "@/components/landing/pricing-teaser";

describe("<PricingTeaser>", () => {
  it("renders the heading, the promises, the ladder, and the full-pricing CTA (PL)", () => {
    render(<PricingTeaser locale="pl" />);
    expect(screen.getByRole("heading", { level: 2, name: /Płacisz tylko za faktury/ })).toBeInTheDocument();
    expect(screen.getByText("Niewykorzystane faktury nie przepadają.")).toBeInTheDocument();
    expect(screen.getByText("2,99 zł")).toBeInTheDocument();
    expect(screen.getByText(/Ceny netto/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zobacz pełny cennik" })).toHaveAttribute("href", "/pricing");
  });

  it("renders the EN CTA to /en/pricing", () => {
    render(<PricingTeaser locale="en" />);
    expect(screen.getByRole("link", { name: "See full pricing" })).toHaveAttribute("href", "/en/pricing");
  });
});
