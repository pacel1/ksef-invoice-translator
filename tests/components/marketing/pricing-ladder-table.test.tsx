import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingLadderTable } from "@/components/marketing/pricing-ladder-table";

const labels = {
  packageHeader: "Pakiet",
  totalHeader: "Cena netto",
  perInvoiceHeader: "Za fakturę"
};

describe("<PricingLadderTable>", () => {
  it("renders the 5 ladder rows (5/10/25/50/100)", () => {
    render(<PricingLadderTable locale="pl" labels={labels} />);
    expect(screen.getByRole("cell", { name: "5" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "10" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "25" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "50" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "100" })).toBeInTheDocument();
  });

  it("renders all three column headers", () => {
    render(<PricingLadderTable locale="pl" labels={labels} />);
    expect(screen.getByRole("columnheader", { name: "Pakiet" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Cena netto" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Za fakturę" })).toBeInTheDocument();
  });

  it("formats prices for PL locale", () => {
    render(<PricingLadderTable locale="pl" labels={labels} />);
    expect(screen.getByText(/6,99\s+zł/)).toBeInTheDocument();
    expect(screen.getByText(/2,99\s+zł/)).toBeInTheDocument();
  });

  it("highlights the current package row when supplied", () => {
    render(<PricingLadderTable locale="pl" labels={labels} currentPackageSize={50} />);
    const row50 = screen.getByRole("cell", { name: "50" }).closest("tr");
    expect(row50?.getAttribute("data-current")).toBe("true");
  });
});
