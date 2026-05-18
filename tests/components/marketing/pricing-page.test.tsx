import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingPage } from "@/components/marketing/pricing-page";

describe("<PricingPage>", () => {
  it("renders the hero headline (PL)", () => {
    render(<PricingPage locale="pl" />);
    expect(screen.getByRole("heading", { level: 1, name: /Cennik prosty jak faktura/i })).toBeInTheDocument();
  });

  it("renders the pricing slider", () => {
    render(<PricingPage locale="pl" />);
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("renders the price ladder table with all 5 sizes", () => {
    render(<PricingPage locale="pl" />);
    expect(screen.getByRole("cell", { name: "5" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "100" })).toBeInTheDocument();
  });

  it("renders the free tier callout", () => {
    render(<PricingPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /1 darmowa faktura w miesiącu/i })).toBeInTheDocument();
  });

  it("renders the pricing FAQ", () => {
    render(<PricingPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /Pytania o cenę/i })).toBeInTheDocument();
  });

  it("switches the hero headline for EN locale", () => {
    render(<PricingPage locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: /Pricing as simple as an invoice/i })).toBeInTheDocument();
  });
});
