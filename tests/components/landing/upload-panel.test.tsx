import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { UploadPanel } from "@/components/landing/demo/upload-panel";
import { buildDemoInvoice } from "@/lib/landing/demo-sample";
import { maxXmlBytes } from "@/lib/demo/upload-limits";

const turnstileMock = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
vi.mock("@marsidev/react-turnstile", async () => {
  const React = await import("react");
  return {
    Turnstile: React.forwardRef(function MockTurnstile(props: Record<string, unknown>, ref: React.Ref<unknown>) {
      Object.assign(turnstileMock.props, props);
      React.useImperativeHandle(ref, () => ({ reset: () => undefined }));
      return React.createElement("div", { "data-testid": "turnstile" });
    })
  };
});

// No NEXT_PUBLIC_TURNSTILE_SITE_KEY in tests -> widget skipped, token "dev".
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllEnvs());

function copy() {
  return {
    uploadLink: "albo wgraj własną fakturę",
    uploadDropLabel: "Przeciągnij plik tutaj albo kliknij, aby wybrać",
    uploadHint: "XML lub PDF z KSeF.",
    uploadBusy: "Tłumaczymy...",
    rateLimited: "Limit.",
    uploadErrUnsupported: "Tylko XML i PDF.",
    uploadErrTooLarge: "Za duży.",
    uploadErrParse: "Nie odczytano.",
    uploadErrBreaker: "Przeciążone.",
    uploadErrTurnstile: "Weryfikacja.",
    uploadErrTranslate: "Błąd tłumaczenia."
  };
}

function okResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ invoice: buildDemoInvoice("en"), sourceXml: "<Faktura/>", uploadToken: "tok" })
  };
}

function selectFile(file: File) {
  const input = screen.getByLabelText("Przeciągnij plik tutaj albo kliknij, aby wybrać");
  fireEvent.change(input, { target: { files: [file] } });
}

function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: "albo wgraj własną fakturę" }));
}

describe("<UploadPanel>", () => {
  it("shows only the reveal link until clicked, then the dropzone", () => {
    render(<UploadPanel lang="en" t={copy()} onResult={vi.fn()} />);
    expect(screen.queryByText("XML lub PDF z KSeF.")).not.toBeInTheDocument();
    openPanel();
    expect(screen.getByText("XML lub PDF z KSeF.")).toBeInTheDocument();
  });

  it("rejects an unsupported file client-side without calling the API", () => {
    render(<UploadPanel lang="en" t={copy()} onResult={vi.fn()} />);
    openPanel();
    selectFile(new File(["x"], "notes.txt", { type: "text/plain" }));
    expect(screen.getByText("Tylko XML i PDF.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized XML client-side without calling the API", () => {
    render(<UploadPanel lang="en" t={copy()} onResult={vi.fn()} />);
    openPanel();
    const big = new File([new Uint8Array(maxXmlBytes() + 1)], "faktura.xml", { type: "application/xml" });
    selectFile(big);
    expect(screen.getByText("Za duży.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads a valid file and reports the result up", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    const onResult = vi.fn();
    render(<UploadPanel lang="en" t={copy()} onResult={onResult} />);
    openPanel();
    selectFile(new File(["<Faktura/>"], "faktura.xml", { type: "application/xml" }));
    await waitFor(() => expect(onResult).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/demo/translate");
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("lang")).toBe("en");
    expect(body.get("turnstileToken")).toBe("dev");
    expect((body.get("file") as File).name).toBe("faktura.xml");
    expect(onResult.mock.calls[0][0]).toMatchObject({ sourceXml: "<Faktura/>", uploadToken: "tok", lang: "en" });
  });

  it.each([
    [422, "Nie odczytano."],
    [429, "Limit."],
    [503, "Przeciążone."],
    [403, "Weryfikacja."],
    [502, "Błąd tłumaczenia."]
  ])("maps a %s response to its message", async (status, message) => {
    fetchMock.mockResolvedValueOnce({ ok: false, status, json: async () => ({}) });
    render(<UploadPanel lang="en" t={copy()} onResult={vi.fn()} />);
    openPanel();
    selectFile(new File(["<x/>"], "faktura.xml", { type: "application/xml" }));
    await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
  });

  it("re-translates the retained file when the language prop changes", async () => {
    fetchMock.mockResolvedValue(okResponse());
    const onResult = vi.fn();
    const view = render(<UploadPanel lang="en" t={copy()} onResult={onResult} />);
    openPanel();
    selectFile(new File(["<Faktura/>"], "faktura.xml", { type: "application/xml" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    view.rerender(<UploadPanel lang="de" t={copy()} onResult={onResult} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect((fetchMock.mock.calls[1][1].body as FormData).get("lang")).toBe("de");
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(2));
    expect(onResult.mock.calls[1][0].lang).toBe("de");
  });

  it("does not re-translate on language change before any upload", () => {
    const view = render(<UploadPanel lang="en" t={copy()} onResult={vi.fn()} />);
    view.rerender(<UploadPanel lang="de" t={copy()} onResult={vi.fn()} />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("<UploadPanel> with a Turnstile site key", () => {
  it("queues a translate while the widget is solving and drains it on token arrival", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "sk-test");
    fetchMock.mockResolvedValueOnce(okResponse());
    const onResult = vi.fn();
    render(<UploadPanel lang="en" t={copy()} onResult={onResult} />);
    openPanel();
    selectFile(new File(["<Faktura/>"], "faktura.xml", { type: "application/xml" }));
    // queued: busy, nothing sent yet
    expect(screen.getByText("Tłumaczymy...")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => {
      (turnstileMock.props.onSuccess as (token: string) => void)("cf-tok");
    });
    await waitFor(() => expect(onResult).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0][1].body as FormData).get("turnstileToken")).toBe("cf-tok");
  });

  it("recovers with an error when the widget fails while a translate is queued", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "sk-test");
    render(<UploadPanel lang="en" t={copy()} onResult={vi.fn()} />);
    openPanel();
    selectFile(new File(["<Faktura/>"], "faktura.xml", { type: "application/xml" }));
    expect(screen.getByText("Tłumaczymy...")).toBeInTheDocument();
    act(() => {
      (turnstileMock.props.onError as () => void)();
    });
    expect(screen.getByText("Weryfikacja.")).toBeInTheDocument();
    expect(screen.getByText("Przeciągnij plik tutaj albo kliknij, aby wybrać")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
