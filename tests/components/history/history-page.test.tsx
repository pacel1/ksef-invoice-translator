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
    buyerName: "Klient",
    totalGross: 12300,
    currency: "PLN",
    createdAt: "2026-05-12T10:00:00Z",
    translatedLanguages: ["en"],
    duplicateCount: 0
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

  it("renders pagination controls when there is more than one page", () => {
    render(
      <HistoryPage
        initialData={{ rows: sampleRows, totalCount: 55, page: 1, perPage: 20 }}
        locale="pl"
      />
    );
    // 3 pages (55 / 20 ceil) — Prev disabled, Next enabled.
    const prev = screen.getByRole("button", { name: /Poprzednia/i });
    const next = screen.getByRole("button", { name: /Następna/i });
    expect(prev).toBeDisabled();
    expect(next).not.toBeDisabled();
    expect(screen.getByText(/Strona 1 z 3/)).toBeInTheDocument();
  });

  it("clicking Next fetches the next page", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        rows: [],
        totalCount: 55,
        page: 2,
        perPage: 20
      })
    });
    render(
      <HistoryPage
        initialData={{ rows: sampleRows, totalCount: 55, page: 1, perPage: 20 }}
        locale="pl"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Następna/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
    expect(lastCall).toContain("page=2");
  });

  it("clicking a sortable header issues a fetch with sortBy + sortOrder", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        rows: [],
        totalCount: 1,
        page: 1,
        perPage: 20
      })
    });
    render(
      <HistoryPage
        initialData={{ rows: sampleRows, totalCount: 1, page: 1, perPage: 20 }}
        locale="pl"
      />
    );
    // The default sort is createdAt DESC. Clicking the Nabywca header
    // should request sortBy=buyerName with the default direction (asc for
    // text columns).
    fireEvent.click(screen.getByRole("button", { name: /Nabywca/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
    expect(lastCall).toContain("sortBy=buyerName");
    expect(lastCall).toContain("sortOrder=asc");
  });

  it("clicking the same header twice flips the sort direction", async () => {
    // Keep the same rows in the response so the table doesn't collapse
    // to the empty state between clicks — otherwise the second click can't
    // find the column header to click again.
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ rows: sampleRows, totalCount: 1, page: 1, perPage: 20 })
    });
    render(
      <HistoryPage
        initialData={{ rows: sampleRows, totalCount: 1, page: 1, perPage: 20 }}
        locale="pl"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Nabywca/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /Nabywca/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
    expect(lastCall).toContain("sortOrder=desc");
  });
});
