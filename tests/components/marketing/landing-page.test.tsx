import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingPage } from "@/components/marketing/landing-page";

describe("<LandingPage>", () => {
  it("renders the hero headline and CTAs (PL)", () => {
    render(<LandingPage locale="pl" />);
    expect(screen.getByRole("heading", { level: 1, name: /Faktura KSeF dla klienta z zagranicy/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Zacznij za darmo/i })).toHaveAttribute("href", "/login");
  });

  it("renders the three value props", () => {
    render(<LandingPage locale="pl" />);
    expect(screen.getByText(/MF-compliant PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/Bez subskrypcji/)).toBeInTheDocument();
    expect(screen.getByText(/Dane w UE/i)).toBeInTheDocument();
  });

  it("renders the FAQ section", () => {
    render(<LandingPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /Najczęstsze pytania/i })).toBeInTheDocument();
    expect(screen.getByText(/Czy potrzebuję integracji z KSeF/i)).toBeInTheDocument();
  });

  it("renders the founder card", () => {
    render(<LandingPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /Stoi za tym konkretny człowiek/i })).toBeInTheDocument();
  });

  it("renders the LegalFooter", () => {
    render(<LandingPage locale="pl" />);
    expect(screen.getByText(/NIP/)).toBeInTheDocument();
  });

  it("switches headlines for EN locale", () => {
    render(<LandingPage locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: /Polish KSeF invoice, translated/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start free/i })).toHaveAttribute("href", "/login");
  });
});
