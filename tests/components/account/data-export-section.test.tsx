import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DataExportSection } from "@/components/account/data-export-section";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  if (!("createObjectURL" in URL)) {
    Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:mock"), configurable: true });
  }
  if (!("revokeObjectURL" in URL)) {
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
  }
  fetchMock.mockReset();
});

const labels = {
  heading: "Eksport danych (RODO)",
  body: "Pobierz pełny eksport swoich danych w formacie JSON.",
  button: "Pobierz dane (JSON)",
  preparing: "Przygotowuję…"
};

describe("<DataExportSection>", () => {
  it("renders the heading + body + button", () => {
    render(<DataExportSection labels={labels} />);
    expect(screen.getByRole("heading", { name: /Eksport danych/i })).toBeInTheDocument();
    expect(screen.getByText(/Pobierz pełny eksport/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pobierz dane/i })).toBeInTheDocument();
  });

  it("POSTs to /api/me/export and shows preparing state during fetch", async () => {
    let resolveFetch!: (value: unknown) => void;
    const pending = new Promise<unknown>((r) => {
      resolveFetch = r;
    });
    fetchMock.mockReturnValue(pending);

    render(<DataExportSection labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: /Pobierz dane/i }));

    await waitFor(() => {
      expect(screen.getByText(/Przygotowuję/i)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/me/export", expect.objectContaining({ method: "POST" }));

    resolveFetch({
      ok: true,
      blob: async () => new Blob(["{}"], { type: "application/json" })
    });
    await waitFor(() => {
      expect(screen.queryByText(/Przygotowuję/i)).not.toBeInTheDocument();
    });
  });
});
