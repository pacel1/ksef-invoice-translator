import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DemoSection } from "@/components/landing/demo/demo-section";
import { buildDemoInvoice } from "@/lib/landing/demo-sample";

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}

beforeEach(() => mockMatchMedia(false));

describe("<DemoSection>", () => {
  it("renders the dark demo stage with the heading and the default English invoice", () => {
    render(<DemoSection locale="pl" />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Zobacz swoją fakturę w innym języku" })
    ).toBeInTheDocument();
    expect(screen.getByText('Oak chair „Helena”')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
  });

  it("re renders the invoice in the chosen language when a chip is clicked", () => {
    render(<DemoSection locale="pl" />);
    fireEvent.click(screen.getByRole("button", { name: "DE" }));
    expect(screen.getByText('Eichenstuhl „Helena”')).toBeInTheDocument();
    expect(screen.queryByText('Oak chair „Helena”')).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "DE" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens the download gate when the primary CTA is clicked", () => {
    render(<DemoSection locale="pl" />);
    expect(screen.queryByLabelText("Adres e-mail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pobierz PDF" }));
    expect(screen.getByLabelText("Adres e-mail")).toBeInTheDocument();
  });

  it("reveals the upload dropzone and renders the uploaded invoice in the stage", async () => {
    const uploaded = {
      ...buildDemoInvoice("en"),
      items: [
        {
          name: "Deska tarasowa modrzewiowa",
          translatedName: "Larch decking board",
          quantity: 10,
          unit: "szt",
          translatedUnit: "pcs",
          unitPrice: 50,
          netValue: 500,
          vatRate: "0",
          grossValue: 500
        }
      ]
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ invoice: uploaded, sourceXml: "<Faktura/>", uploadToken: "tok" })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoSection locale="pl" />);
    expect(screen.queryByLabelText("Przeciągnij plik tutaj albo kliknij, aby wybrać")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "albo wgraj własną fakturę" }));
    const input = screen.getByLabelText("Przeciągnij plik tutaj albo kliknij, aby wybrać");
    fireEvent.change(input, { target: { files: [new File(["<Faktura/>"], "faktura.xml", { type: "application/xml" })] } });
    await waitFor(() => expect(screen.getByText("Larch decking board")).toBeInTheDocument());
    expect(screen.queryByText('Oak chair „Helena”')).not.toBeInTheDocument();
  });
});
