import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentInvoicesSidebarView } from "@/components/workspace/recent-invoices-sidebar";
import type { InvoiceSummary } from "@/lib/invoice/recent-invoices";

// NewTranslationLink (rendered inside the view) calls useRouter at mount.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

const sample: InvoiceSummary[] = [
  {
    id: "i1",
    invoiceNumber: "F/24/0148",
    issueDate: "2026-05-12",
    sellerName: "ACME Sp. z o.o.",
    buyerName: "Klient",
    totalGross: 12300,
    currency: "PLN",
    createdAt: "2026-05-12T10:00:00Z",
    translatedLanguages: ["en", "de"],
    duplicateCount: 0
  },
  {
    id: "i2",
    invoiceNumber: "F/24/0147",
    issueDate: "2026-05-11",
    sellerName: "Beta",
    buyerName: null,
    totalGross: 4567,
    currency: "PLN",
    createdAt: "2026-05-11T10:00:00Z",
    translatedLanguages: [],
    duplicateCount: 0
  }
];

// Post-cutover labels (PR #E) — sidebar now points at /translate.
const baseLabels = {
  newInvoiceLabel: "+ Nowe tłumaczenie",
  recentHeading: "Ostatnie",
  allArchive: "Historia",
  helpLabel: "Pomoc",
  contactLabel: "Kontakt"
};

describe("<RecentInvoicesSidebarView>", () => {
  it("renders the New Translation CTA", () => {
    render(<RecentInvoicesSidebarView invoices={[]} labels={baseLabels} />);
    expect(
      screen.getByRole("button", { name: /Nowe tłumaczenie/i })
    ).toBeInTheDocument();
  });

  it("renders the Recent heading + Historia link pointing at /translate/history", () => {
    render(<RecentInvoicesSidebarView invoices={sample} labels={baseLabels} />);
    expect(screen.getByText(/Ostatnie/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Historia/i })
    ).toHaveAttribute("href", "/translate/history");
  });

  it("renders each invoice with number and translated language pills", () => {
    render(<RecentInvoicesSidebarView invoices={sample} labels={baseLabels} />);
    expect(screen.getByText("F/24/0148")).toBeInTheDocument();
    expect(screen.getByText("F/24/0147")).toBeInTheDocument();
    // Each invoice gets a PL pill (source) + one pill per translated language.
    // sample[0] has 2 translations (en, de) → 1 PL + 2 = 3 pills on row 0
    // sample[1] has 0 translations → 1 PL pill on row 1
    // Total PL pills across rows: 2
    expect(screen.getAllByText("PL").length).toBe(2);
    expect(screen.getByText("EN")).toBeInTheDocument();
    expect(screen.getByText("DE")).toBeInTheDocument();
  });

  it("renders Help and Contact at the bottom", () => {
    render(<RecentInvoicesSidebarView invoices={[]} labels={baseLabels} />);
    expect(screen.getByText(/Pomoc/i)).toBeInTheDocument();
    expect(screen.getByText(/Kontakt/i)).toBeInTheDocument();
  });

  it("omits invoice rows when invoices array is empty", () => {
    render(<RecentInvoicesSidebarView invoices={[]} labels={baseLabels} />);
    expect(screen.queryByText(/F\/24\//)).not.toBeInTheDocument();
  });
});
