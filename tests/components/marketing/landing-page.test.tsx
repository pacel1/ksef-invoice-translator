import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingPage } from "@/components/marketing/landing-page";

describe("<LandingPage>", () => {
  it("renders the hero headline and a primary CTA to /login (PL)", () => {
    render(<LandingPage locale="pl" />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Faktura KSeF dla klienta z zagranicy/i })
    ).toBeInTheDocument();
    // "Zacznij za darmo" now appears in both the hero and the risk-reversal section.
    const ctas = screen.getAllByRole("link", { name: /Zacznij za darmo/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", "/login");
    }
  });

  it("renders the How-it-works section", () => {
    render(<LandingPage locale="pl" />);
    expect(
      screen.getByRole("heading", { name: /Od pliku KSeF do gotowego PDF/i })
    ).toBeInTheDocument();
  });

  it("renders the features section", () => {
    render(<LandingPage locale="pl" />);
    expect(screen.getByText(/Każde pole MF FA\(3\) zachowane/i)).toBeInTheDocument();
  });

  it("renders the risk-reversal section", () => {
    render(<LandingPage locale="pl" />);
    expect(
      screen.getByRole("heading", { name: /Zacznij bez ryzyka/i })
    ).toBeInTheDocument();
  });

  it("renders the FAQ section", () => {
    render(<LandingPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /Najczęstsze pytania/i })).toBeInTheDocument();
    expect(screen.getByText(/Czy potrzebuję integracji z KSeF/i)).toBeInTheDocument();
  });

  it("renders the LegalFooter", () => {
    render(<LandingPage locale="pl" />);
    expect(screen.getByText(/NIP/)).toBeInTheDocument();
  });

  it("no longer renders the removed founder or testimonials sections", () => {
    render(<LandingPage locale="pl" />);
    expect(screen.queryByText(/Stoi za tym konkretny człowiek/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Beta — pierwsze opinie/i)).not.toBeInTheDocument();
  });

  it("switches headlines and CTAs for EN locale", () => {
    render(<LandingPage locale="en" />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Polish KSeF invoice, translated/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /From a KSeF file to a ready PDF/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Start with zero risk/i })
    ).toBeInTheDocument();
    const ctas = screen.getAllByRole("link", { name: /Start free/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", "/login");
    }
  });
});
