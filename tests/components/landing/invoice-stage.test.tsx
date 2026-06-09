import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceStage } from "@/components/landing/demo/invoice-stage";

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
});
