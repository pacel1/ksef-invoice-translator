import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceSnippet } from "@/components/trust/price-snippet";

describe("<PriceSnippet>", () => {
  it("renders 'od 2,99 zł za fakturę' in PL", () => {
    render(<PriceSnippet />);
    expect(screen.getByText(/od\s+2,99\s+zł\s+za\s+fakturę/i)).toBeInTheDocument();
  });

  it("renders 'from PLN 2.99 per invoice' in EN", () => {
    render(<PriceSnippet locale="en" />);
    expect(screen.getByText(/from\s+PLN\s+2\.99\s+per\s+invoice/i)).toBeInTheDocument();
  });

  it("adds the 'Bez subskrypcji' tagline when variant='full'", () => {
    render(<PriceSnippet variant="full" />);
    expect(screen.getByText(/Bez subskrypcji/i)).toBeInTheDocument();
  });

  it("omits the tagline when variant='inline'", () => {
    render(<PriceSnippet variant="inline" />);
    expect(screen.queryByText(/Bez subskrypcji/i)).not.toBeInTheDocument();
  });
});
