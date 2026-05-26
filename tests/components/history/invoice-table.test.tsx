import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InvoiceTable } from "@/components/history/invoice-table";
import type { InvoiceSummary } from "@/lib/invoice/recent-invoices";

const labels = {
  numberHeader: "Numer",
  dateHeader: "Data wystawienia",
  sellerHeader: "Sprzedawca",
  buyerHeader: "Nabywca",
  amountHeader: "Kwota",
  languagesHeader: "Języki",
  actionsHeader: "Akcje",
  openLabel: "Otwórz",
  emptyMessage: "Brak faktur do wyświetlenia.",
  mobileLabelDate: "Data",
  mobileLabelSeller: "Sprzedawca",
  mobileLabelBuyer: "Nabywca",
  mobileLabelAmount: "Kwota",
  mobileLabelLanguages: "Status"
};

// invoices.total_gross is stored as a decimal PLN amount (not cents),
// so a real-world '123.29 PLN' row stores total_gross = 123.29.
const sample: InvoiceSummary[] = [
  {
    id: "i1",
    invoiceNumber: "F/24/0148",
    issueDate: "2026-05-12",
    sellerName: "ACME Sp. z o.o.",
    buyerName: "Klient Sp. z o.o.",
    totalGross: 18597.6,
    currency: "PLN",
    createdAt: "2026-05-12T10:00:00Z",
    translatedLanguages: ["en", "de"],
    duplicateCount: 0
  },
  {
    id: "i2",
    invoiceNumber: "F/24/0147",
    issueDate: "2026-05-11",
    sellerName: null,
    buyerName: null,
    totalGross: null,
    currency: null,
    createdAt: "2026-05-11T10:00:00Z",
    translatedLanguages: [],
    duplicateCount: 0
  }
];

describe("<InvoiceTable>", () => {
  it("renders all column headers including Nabywca", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    expect(screen.getByRole("columnheader", { name: /Numer/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Data wystawienia/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Sprzedawca/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Nabywca/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Kwota/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Języki/ })).toBeInTheDocument();
  });

  it("renders buyer name in the Nabywca column", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    // Buyer text appears in both the desktop table row and the mobile card.
    expect(screen.getAllByText("Klient Sp. z o.o.").length).toBe(2);
  });

  it("makes sortable headers clickable and surfaces direction via aria-sort", () => {
    const onSort = vi.fn();
    render(
      <InvoiceTable
        rows={sample}
        labels={labels}
        sort={{ by: "createdAt", order: "desc" }}
        onSort={onSort}
      />
    );
    const dateHeader = screen.getByRole("columnheader", { name: /Data wystawienia/ });
    expect(dateHeader).toHaveAttribute("aria-sort", "descending");

    // Clicking the date header again should request the opposite direction.
    fireEvent.click(screen.getByRole("button", { name: /Data wystawienia/ }));
    expect(onSort).toHaveBeenCalledWith("createdAt");

    // Clicking a different column should request that column (the parent
    // decides the default direction).
    fireEvent.click(screen.getByRole("button", { name: /Nabywca/ }));
    expect(onSort).toHaveBeenCalledWith("buyerName");
  });

  it("does NOT make headers clickable when onSort is omitted", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    // No button-role headers — they should be plain text.
    expect(
      screen.queryByRole("button", { name: /Data wystawienia/ })
    ).toBeNull();
  });

  it("renders one row per invoice with the invoice number", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    // Each invoice number renders once in the desktop row and once in the
    // mobile card.
    expect(screen.getAllByText("F/24/0148").length).toBe(2);
    expect(screen.getAllByText("F/24/0147").length).toBe(2);
  });

  it("shows language pills for translated languages plus PL source", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    // Two rows × two renders (desktop + mobile) = 4 PL pills.
    expect(screen.getAllByText("PL").length).toBe(4);
    // Row 1's EN/DE pills also render twice (desktop + mobile).
    expect(screen.getAllByText("EN").length).toBe(2);
    expect(screen.getAllByText("DE").length).toBe(2);
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
    // Amount appears in desktop row + mobile card.
    expect(screen.getAllByText("18597,60 PLN").length).toBe(2);
    expect(screen.queryByText("185,98 PLN")).toBeNull();
  });

  it("renders an Open link per row pointing at /translate?invoiceId=...", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    // Two rows × two renders (desktop + mobile) = 4 Open links.
    const links = screen.getAllByRole("link", { name: /Otwórz/i });
    expect(links.length).toBe(4);
    for (const link of links) {
      const href = link.getAttribute("href");
      expect(
        href === `/translate?invoiceId=${sample[0].id}` ||
          href === `/translate?invoiceId=${sample[1].id}`
      ).toBe(true);
    }
  });

  it("renders the empty state when rows is empty", () => {
    render(<InvoiceTable rows={[]} labels={labels} />);
    expect(screen.getByText(/Brak faktur do wyświetlenia/i)).toBeInTheDocument();
  });

  it("shows a duplicate badge when an invoice has copies", () => {
    const dupes: InvoiceSummary[] = [
      {
        id: "i1",
        invoiceNumber: "F/24/0148",
        issueDate: "2026-05-12",
        sellerName: "ACME",
        buyerName: "Klient",
        totalGross: 100,
        currency: "PLN",
        createdAt: "2026-05-12T10:00:00Z",
        translatedLanguages: [],
        duplicateCount: 2
      }
    ];
    render(
      <InvoiceTable
        rows={dupes}
        labels={{ ...labels, duplicatesBadge: "+{count} kopie" }}
      />
    );
    // Badge appears in desktop row + mobile card.
    expect(screen.getAllByText("+2 kopie").length).toBe(2);
  });

  it("does NOT show a duplicate badge when duplicateCount is 0", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    // sample rows have no duplicateCount set (treated as 0).
    expect(screen.queryByText(/\+\d+ kopi/)).toBeNull();
  });

  it("marks every visible column header with whitespace-nowrap", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    const headers = screen.getAllByRole("columnheader");
    // Seven columns: Numer / Data / Sprzedawca / Nabywca / Kwota / Status / Akcje
    expect(headers.length).toBe(7);
    for (const th of headers) {
      expect(th.className).toMatch(/whitespace-nowrap/);
    }
  });

  it("renders a <colgroup> with 7 <col>s summing to 100%", () => {
    const { container } = render(<InvoiceTable rows={sample} labels={labels} />);
    const colgroup = container.querySelector("colgroup");
    expect(colgroup).not.toBeNull();
    const cols = colgroup!.querySelectorAll("col");
    expect(cols.length).toBe(7);
    let total = 0;
    for (const col of Array.from(cols)) {
      const width = col.getAttribute("style") ?? "";
      // Pull the percentage out of e.g. "width: 14%;"
      const match = width.match(/(\d+(?:\.\d+)?)%/);
      expect(match).not.toBeNull();
      total += Number(match![1]);
    }
    expect(total).toBe(100);
  });

  it("on mobile renders a card list with one card per row", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    const list = screen.getByTestId("invoice-card-list");
    expect(list).toBeInTheDocument();
    const cards = screen.getAllByTestId("invoice-card");
    expect(cards.length).toBe(sample.length);
  });

  it("each mobile card shows number, date, seller, buyer, amount, languages, and Open link", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    const cards = screen.getAllByTestId("invoice-card");
    const first = cards[0];
    expect(first.textContent).toContain("F/24/0148");
    expect(first.textContent).toContain("2026-05-12");
    expect(first.textContent).toContain("ACME Sp. z o.o.");
    expect(first.textContent).toContain("Klient Sp. z o.o.");
    expect(first.textContent).toContain("18597,60 PLN");
    // PL pill must be present, identifiable by testid.
    const pills = screen.getAllByTestId("lang-pill-PL");
    // Two rows × two renders (desktop + mobile) = 4 PL pills.
    expect(pills.length).toBe(4);
    // The first mobile card contains at least one PL pill.
    expect(first.querySelector('[data-testid="lang-pill-PL"]')).not.toBeNull();
    // Open link exists inside the card.
    const openLink = first.querySelector("a[href*='/translate?invoiceId=']");
    expect(openLink).not.toBeNull();
    expect(openLink!.textContent).toMatch(/Otwórz/);
  });
});
