import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn()
  }));
});

import { Hero } from "@/components/landing/hero";

describe("<Hero>", () => {
  it("renders the eyebrow, the level-1 headline (lead + turn), and the subline (PL)", () => {
    render(<Hero locale="pl" />);
    expect(screen.getByText("Faktura KSeF dla kontrahenta z zagranicy")).toBeInTheDocument();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(/Znowu przepisujesz fakturę/);
    expect(h1).toHaveTextContent(/Już nie musisz\./);
  });

  it("renders both CTAs pointing to the demo anchor", () => {
    render(<Hero locale="pl" />);
    expect(screen.getByRole("link", { name: "Przetłumacz swoją fakturę" })).toHaveAttribute("href", "#demo");
    expect(screen.getByRole("link", { name: "Zobacz na przykładzie" })).toHaveAttribute("href", "#demo");
  });

  it("renders the EN headline", () => {
    render(<Hero locale="en" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Still retyping your KSeF invoice/);
  });
});
