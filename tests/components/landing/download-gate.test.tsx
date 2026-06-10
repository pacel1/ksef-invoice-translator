import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DownloadGate } from "@/components/landing/demo/download-gate";
import { buildDemoInvoice } from "@/lib/landing/demo-sample";

// No NEXT_PUBLIC_TURNSTILE_SITE_KEY in tests -> widget is skipped, token defaults to "dev".
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  global.URL.createObjectURL = vi.fn(() => "blob:demo");
  global.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

function copy() {
  return {
    gateHeading: "Wpisz e-mail",
    emailLabel: "Adres e-mail",
    emailPlaceholder: "twoj@email.pl",
    consent: "Zero spamu.",
    marketingOptIn: "Wskazówki (opcjonalnie).",
    submit: "Wyślij i pobierz",
    success: "Gotowe.",
    gateError: "Błąd.",
    rateLimited: "Limit.",
    pdfFailed: "Błąd PDF."
  };
}

describe("<DownloadGate>", () => {
  it("submits email, unlocks, downloads the PDF, and shows success", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloadToken: "tok" }) }) // /unlock
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["%PDF"]) }); // /pdf
    render(<DownloadGate lang="de" t={copy()} />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    await waitFor(() => expect(screen.getByText("Gotowe.")).toBeInTheDocument());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/demo/unlock");
    const unlockBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(unlockBody).toMatchObject({ email: "a@b.com", lang: "de", turnstileToken: "dev" });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/demo/pdf");
  });

  it("shows the rate-limit message on 429", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ code: "rate_limited" }) });
    render(<DownloadGate lang="en" t={copy()} />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    await waitFor(() => expect(screen.getByText("Limit.")).toBeInTheDocument());
  });

  it("shows the error message when the unlock step fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 }); // /unlock fails
    render(<DownloadGate lang="en" t={copy()} />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    await waitFor(() => expect(screen.getByText("Błąd.")).toBeInTheDocument());
  });

  it("requires a valid email before submitting", async () => {
    render(<DownloadGate lang="en" t={copy()} />);
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unlocks with source upload and re-sends the upload payload to /api/demo/pdf", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloadToken: "tok" }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["%PDF"]) });
    const upload = { invoice: buildDemoInvoice("de"), sourceXml: "<Faktura/>", uploadToken: "utok", lang: "de" as const };
    render(<DownloadGate lang="de" t={copy()} upload={upload} />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    await waitFor(() => expect(screen.getByText("Gotowe.")).toBeInTheDocument());
    const unlockBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(unlockBody.source).toBe("upload");
    const pdfBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(pdfBody).toMatchObject({ downloadToken: "tok", sourceXml: "<Faktura/>", uploadToken: "utok" });
    expect(pdfBody.invoice.invoiceNumber).toBe("FV 2026/05/0142");
  });

  it("sends source sample and no upload payload without an upload", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloadToken: "tok" }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["%PDF"]) });
    render(<DownloadGate lang="en" t={copy()} />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    await waitFor(() => expect(screen.getByText("Gotowe.")).toBeInTheDocument());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).source).toBe("sample");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ downloadToken: "tok" });
  });

  it("shows the rate-limit message when the pdf route returns 429", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloadToken: "tok" }) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ code: "rate_limited" }) });
    render(<DownloadGate lang="en" t={copy()} />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    await waitFor(() => expect(screen.getByText("Limit.")).toBeInTheDocument());
  });

  it("shows the pdf-failed message when rendering fails", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloadToken: "tok" }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    render(<DownloadGate lang="en" t={copy()} />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    await waitFor(() => expect(screen.getByText("Błąd PDF.")).toBeInTheDocument());
  });
});
