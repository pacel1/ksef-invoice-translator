/* @vitest-environment jsdom */
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let mockRows: Array<Record<string, unknown>> = [];

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockRows, error: null })
    })
  })
}));

import { PurchaseHistory } from "@/components/billing/purchase-history";

async function renderPurchaseHistory() {
  const tree = await PurchaseHistory({ userId: "u1", uiLanguage: "pl" });
  render(tree as React.ReactElement);
}

describe("<PurchaseHistory>", () => {
  it("renders 'W toku' badge for a row whose faktura is pending", async () => {
    mockRows = [
      {
        id: "p1",
        package_size: 50,
        total_amount_cents: 50000,
        currency: "pln",
        status: "paid",
        created_at: "2026-05-27T10:00:00Z",
        paid_at: "2026-05-27T10:00:01Z",
        ksef_invoices: [{ id: "ksef-p1", kind: "vat", gov_status: "pending", provider_invoice_id: null }]
      }
    ];
    await renderPurchaseHistory();
    // The "W toku" string also appears as a stripe_purchases.status label, so
    // assert that AT LEAST one badge with that text exists (faktura column).
    const matches = screen.getAllByText(/W toku/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders 'Wystawiona ✓' + PDF link when faktura is ok with a provider_invoice_id", async () => {
    mockRows = [
      {
        id: "p2",
        package_size: 10,
        total_amount_cents: 10000,
        currency: "pln",
        status: "paid",
        created_at: "2026-05-27T10:00:00Z",
        paid_at: "2026-05-27T10:00:01Z",
        ksef_invoices: [
          { id: "ksef-p2", kind: "vat", gov_status: "ok", provider_invoice_id: "1244512" }
        ]
      }
    ];
    await renderPurchaseHistory();
    expect(screen.getByText(/Wystawiona/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Pobierz PDF/ });
    expect(link).toHaveAttribute("href", "/api/invoices/ksef-p2/pdf");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders 'Błąd' for send_error or failed faktura", async () => {
    mockRows = [
      {
        id: "p3",
        package_size: 10,
        total_amount_cents: 10000,
        currency: "pln",
        status: "paid",
        created_at: "2026-05-27T10:00:00Z",
        paid_at: "2026-05-27T10:00:01Z",
        ksef_invoices: [{ id: "ksef-p3", kind: "vat", gov_status: "send_error", provider_invoice_id: null }]
      }
    ];
    await renderPurchaseHistory();
    expect(screen.getByText(/Błąd/)).toBeInTheDocument();
  });

  it("renders '—' when no faktura row exists yet", async () => {
    mockRows = [
      {
        id: "p4",
        package_size: 10,
        total_amount_cents: 10000,
        currency: "pln",
        status: "paid",
        created_at: "2026-05-27T10:00:00Z",
        paid_at: "2026-05-27T10:00:01Z",
        ksef_invoices: []
      }
    ];
    await renderPurchaseHistory();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
