import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LegalFooter } from "@/components/layout/legal-footer";

describe("<LegalFooter>", () => {
  it("renders all three column headings (PL default)", () => {
    render(<LegalFooter />);
    expect(screen.getAllByText(/Tłumacz Faktur KSeF/)).toHaveLength(2);
    expect(screen.getByRole("heading", { name: /Produkt/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Zaufanie/i })).toBeInTheDocument();
  });

  it("shows the legal line with NIP, REGON, and address", () => {
    render(<LegalFooter />);
    expect(screen.getByText(/NIP\s+\d/i)).toBeInTheDocument();
    expect(screen.getByText(/REGON/i)).toBeInTheDocument();
  });

  it("links to /pricing, /security, /terms, /privacy", () => {
    render(<LegalFooter />);
    expect(screen.getByRole("link", { name: "Cennik" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Bezpieczeństwo" })).toHaveAttribute("href", "/security");
    expect(screen.getByRole("link", { name: "Regulamin" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Polityka prywatności" })).toHaveAttribute("href", "/privacy");
  });

  it("renders the EN mirror when locale='en'", () => {
    render(<LegalFooter locale="en" />);
    expect(screen.getByRole("heading", { name: /Product/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pricing" })).toBeInTheDocument();
    expect(screen.getByText(/GDPR-compliant/i)).toBeInTheDocument();
  });

  it("includes the Frankfurt hosting badge", () => {
    render(<LegalFooter />);
    expect(screen.getByText(/Frankfurt/i)).toBeInTheDocument();
  });
});
