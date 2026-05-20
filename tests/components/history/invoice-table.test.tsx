import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceTable } from "@/components/history/invoice-table";
import type { InvoiceSummary } from "@/lib/invoice/recent-invoices";

const labels = {
  numberHeader: "Numer",
  dateHeader: "Data wystawienia",
  sellerHeader: "Sprzedawca",
  amountHeader: "Kwota",
  languagesHeader: "Języki",
  actionsHeader: "Akcje",
  openLabel: "Otwórz",
  emptyMessage: "Brak faktur do wyświetlenia."
};

// invoices.total_gross is stored as a decimal PLN amount (not cents),
// so a real-world '123.29 PLN' row stores total_gross = 123.29.
const sample: InvoiceSummary[] = [
  {
    id: "i1",
    invoiceNumber: "F/24/0148",
    issueDate: "2026-05-12",
    sellerName: "ACME Sp. z o.o.",
    totalGross: 18597.6,
    currency: "PLN",
    createdAt: "2026-05-12T10:00:00Z",
    translatedLanguages: ["en", "de"]
  },
  {
    id: "i2",
    invoiceNumber: "F/24/0147",
    issueDate: "2026-05-11",
    sellerName: null,
    totalGross: null,
    currency: null,
    createdAt: "2026-05-11T10:00:00Z",
    translatedLanguages: []
  }
];

describe("<InvoiceTable>", () => {
  it("renders all column headers", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    expect(screen.getByRole("columnheader", { name: /Numer/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Data wystawienia/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Sprzedawca/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Kwota/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Języki/ })).toBeInTheDocument();
  });

  it("renders one row per invoice with the invoice number", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    expect(screen.getByText("F/24/0148")).toBeInTheDocument();
    expect(screen.getByText("F/24/0147")).toBeInTheDocument();
  });

  it("shows language pills for translated languages plus PL source", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    // Each row has a PL pill + one pill per translated language.
    // sample[0] (en, de): PL + EN + DE = 3 pills
    // sample[1] (none): PL = 1 pill
    // Total PL pills: 2
    expect(screen.getAllByText("PL").length).toBe(2);
    expect(screen.getByText("EN")).toBeInTheDocument();
    expect(screen.getByText("DE")).toBeInTheDocument();
  });

  it("renders '—' for missing values (date, seller, amount)", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    // Row 2 has nulls for sellerName, totalGross, currency
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders the amount as stored (decimal PLN, NOT divided by 100)", () => {
    // Regression test for the /100 bug that made 18597.60 render as 185.98
    // — invoices.total_gross is decimal, not cents.
    render(<InvoiceTable rows={sample} labels={labels} />);
    expect(screen.getByText("18597,60 PLN")).toBeInTheDocument();
    expect(screen.queryByText("185,98 PLN")).toBeNull();
  });

  it("renders an Open link per row pointing at /translate?invoiceId=...", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    const links = screen.getAllByRole("link", { name: /Otwórz/i });
    expect(links.length).toBe(2);
    expect(links[0]).toHaveAttribute(
      "href",
      `/translate?invoiceId=${sample[0].id}`
    );
    expect(links[1]).toHaveAttribute(
      "href",
      `/translate?invoiceId=${sample[1].id}`
    );
  });

  it("renders the empty state when rows is empty", () => {
    render(<InvoiceTable rows={[]} labels={labels} />);
    expect(screen.getByText(/Brak faktur do wyświetlenia/i)).toBeInTheDocument();
  });
});
