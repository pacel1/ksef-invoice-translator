import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceStage } from "@/components/landing/demo/invoice-stage";
import { buildDemoInvoice } from "@/lib/landing/demo-sample";

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
});

describe("<InvoiceStage>", () => {
  it("renders the invoice for the given language and shows the watermark", () => {
    render(<InvoiceStage lang="en" watermark="PREVIEW" />);
    expect(screen.getByText('Oak chair „Helena”')).toBeInTheDocument();
    expect(screen.getByText("PREVIEW")).toBeInTheDocument();
  });

  it("renders a provided uploaded invoice instead of the baked sample", () => {
    const uploaded = {
      ...buildDemoInvoice("de"),
      items: [
        {
          name: "Deska tarasowa modrzewiowa",
          translatedName: "Lärchen-Terrassendiele",
          quantity: 10,
          unit: "szt",
          translatedUnit: "Stk.",
          unitPrice: 50,
          netValue: 500,
          vatRate: "0",
          grossValue: 500
        }
      ]
    };
    render(<InvoiceStage lang="en" watermark="PODGLĄD" upload={{ invoice: uploaded, lang: "de" }} />);
    expect(screen.getByText("Lärchen-Terrassendiele")).toBeInTheDocument();
    expect(screen.queryByText('Oak chair „Helena”')).not.toBeInTheDocument();
  });
});
