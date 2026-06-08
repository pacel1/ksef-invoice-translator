import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />
}));

import { HeroSection } from "@/components/ui/hero-section-9";

const baseProps = {
  title: "Faktura KSeF dla klienta z zagranicy. W 4 sekundy.",
  subtitle: "Przetłumacz fakturę FA(3).",
  eyebrow: "MF FA(3) · schemat 2025-06-25",
  note: "od 2,99 zł za fakturę",
  actions: [{ text: "Zacznij za darmo", href: "/login", variant: "default" as const }],
  stats: [
    { value: "20+", label: "języków", icon: <svg data-testid="i1" /> },
    { value: "≈4 s", label: "na fakturę", icon: <svg data-testid="i2" /> }
  ],
  images: [
    { src: "/marketing/invoice-pl.svg", alt: "Faktura PL" },
    { src: "/marketing/invoice-en.svg", alt: "Invoice EN" }
  ] as [{ src: string; alt: string }, { src: string; alt: string }],
  translationLabel: "4 s"
};

describe("<HeroSection>", () => {
  it("renders the eyebrow text", () => {
    render(<HeroSection {...baseProps} />);
    expect(screen.getByText("MF FA(3) · schemat 2025-06-25")).toBeInTheDocument();
  });

  it("renders the H1 and the primary CTA linking to /login", () => {
    render(<HeroSection {...baseProps} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Faktura KSeF dla klienta z zagranicy/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zacznij za darmo" })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("renders each stat value and label", () => {
    render(<HeroSection {...baseProps} />);
    expect(screen.getByText("20+")).toBeInTheDocument();
    expect(screen.getByText("języków")).toBeInTheDocument();
    expect(screen.getByText("≈4 s")).toBeInTheDocument();
    expect(screen.getByText("na fakturę")).toBeInTheDocument();
  });

  it("renders the source and result images", () => {
    render(<HeroSection {...baseProps} />);
    expect(screen.getByAltText("Faktura PL")).toBeInTheDocument();
    expect(screen.getByAltText("Invoice EN")).toBeInTheDocument();
  });
});
