import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { InvoiceShowcase } from "@/components/landing/invoice-showcase";

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

afterEach(() => {
  vi.useRealTimers();
});

describe("<InvoiceShowcase>", () => {
  it("renders the Polish invoice first, with the locked values and all six language pills", () => {
    mockMatchMedia(false);
    vi.useFakeTimers();
    render(<InvoiceShowcase />);
    expect(screen.getByText("FAKTURA")).toBeInTheDocument();
    expect(screen.getByText("Razem do zapłaty")).toBeInTheDocument();
    // locked values
    expect(screen.getByText("FV 2026/04/118")).toBeInTheDocument();
    expect(screen.getByText(/12 300,00/)).toBeInTheDocument();
    // language pills
    for (const code of ["PL", "EN", "DE", "FR", "ES", "IT"]) {
      expect(screen.getByText(code, { exact: true })).toBeInTheDocument();
    }
  });

  it("cycles to English after one interval: labels and currency localize, locked values stay", () => {
    mockMatchMedia(false);
    vi.useFakeTimers();
    render(<InvoiceShowcase />);
    // "zł" renders twice (item + total), so use getAllByText
    expect(screen.getAllByText("zł").length).toBeGreaterThanOrEqual(1);
    act(() => {
      vi.advanceTimersByTime(2400 + 250);
    });
    expect(screen.getByText("INVOICE")).toBeInTheDocument();
    expect(screen.getByText("Total due")).toBeInTheDocument();
    expect(screen.getAllByText("PLN").length).toBeGreaterThanOrEqual(1);
    // locked values unchanged
    expect(screen.getByText("FV 2026/04/118")).toBeInTheDocument();
    expect(screen.getByText(/12 300,00/)).toBeInTheDocument();
  });

  it("respects reduced motion: shows a static English invoice and does not cycle", () => {
    mockMatchMedia(true);
    vi.useFakeTimers();
    render(<InvoiceShowcase />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("INVOICE")).toBeInTheDocument();
    expect(screen.queryByText("RECHNUNG")).not.toBeInTheDocument();
  });

  it("keeps the scan overlay invisible at rest (no purple artifact)", () => {
    mockMatchMedia(false);
    const { container } = render(<InvoiceShowcase />);
    const scan = container.querySelector('[class*="showcase-scan"]');
    expect(scan).not.toBeNull();
    expect(scan!.className).toContain("opacity-0");
  });

  it("pins the status to a stable layout so the strip height never depends on the language", () => {
    mockMatchMedia(false);
    render(<InvoiceShowcase />);
    const status = screen.getByText("Gotowe").closest("span.inline-flex");
    expect(status).not.toBeNull();
    expect(status!.className).toContain("w-full");
    expect(status!.className).toContain("min-[480px]:w-auto");
  });
});
