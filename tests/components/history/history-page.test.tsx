import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HistoryPage } from "@/components/history/history-page";
import type { InvoiceSummary } from "@/lib/invoice/recent-invoices";

const sampleRows: InvoiceSummary[] = [
  {
    id: "i1",
    invoiceNumber: "F/24/0148",
    issueDate: "2026-05-12",
    sellerName: "ACME",
    totalGross: 12300,
    currency: "PLN",
    createdAt: "2026-05-12T10:00:00Z",
    translatedLanguages: ["en"]
  }
];

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("<HistoryPage>", () => {
  it("renders the heading and initial rows", () => {
    render(
      <HistoryPage
        initialData={{ rows: sampleRows, totalCount: 1, page: 1, perPage: 20 }}
        locale="pl"
      />
    );
    expect(screen.getByRole("heading", { level: 1, name: /Historia faktur/i })).toBeInTheDocument();
    expect(screen.getByText("F/24/0148")).toBeInTheDocument();
  });

  it("renders the filter bar", () => {
    render(
      <HistoryPage
        initialData={{ rows: sampleRows, totalCount: 1, page: 1, perPage: 20 }}
        locale="pl"
      />
    );
    expect(screen.getByLabelText(/Szukaj/i)).toBeInTheDocument();
  });

  it("refetches when search changes", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [], totalCount: 0, page: 1, perPage: 20 })
    });
    render(
      <HistoryPage
        initialData={{ rows: sampleRows, totalCount: 1, page: 1, perPage: 20 }}
        locale="pl"
      />
    );
    fireEvent.change(screen.getByLabelText(/Szukaj/i), { target: { value: "FOO" } });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
    expect(lastCall).toContain("search=FOO");
  });

  it("renders the empty state when no rows", () => {
    render(
      <HistoryPage
        initialData={{ rows: [], totalCount: 0, page: 1, perPage: 20 }}
        locale="pl"
      />
    );
    expect(screen.getByText(/Brak faktur do wyświetlenia/i)).toBeInTheDocument();
  });
});
