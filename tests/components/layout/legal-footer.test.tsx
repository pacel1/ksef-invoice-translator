import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LegalFooter } from "@/components/layout/legal-footer";
import { LEGAL_ENTITY } from "@/lib/brand/legal";

describe("<LegalFooter>", () => {
  it("renders the brand lockup and all column headings (PL default)", () => {
    render(<LegalFooter />);
    expect(screen.getByText(/Tłumacz Faktur KSeF/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Produkt/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Zaufanie/i })).toBeInTheDocument();
  });

  it("shows the legal line with the entity name, NIP, REGON, and address", () => {
    render(<LegalFooter />);
    const legalLine = screen.getByText(new RegExp(`NIP ${LEGAL_ENTITY.nip}`));
    expect(legalLine).toHaveTextContent(LEGAL_ENTITY.name);
    expect(legalLine).toHaveTextContent(`REGON ${LEGAL_ENTITY.regon}`);
    expect(legalLine).toHaveTextContent(LEGAL_ENTITY.address);
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
