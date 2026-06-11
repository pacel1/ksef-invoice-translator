import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicHeader } from "@/components/layout/public-header";

describe("<PublicHeader>", () => {
  it("renders the brand lockup linking to /", () => {
    render(<PublicHeader />);
    expect(screen.getByRole("link", { name: /Tłumacz Faktur KSeF/i })).toHaveAttribute("href", "/");
  });

  it("renders Cennik + Bezpieczeństwo nav links (PL default)", () => {
    render(<PublicHeader />);
    expect(screen.getByRole("link", { name: "Cennik" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Bezpieczeństwo" })).toHaveAttribute("href", "/security");
  });

  it("renders the Zaloguj się CTA as a button-styled link to /login", () => {
    render(<PublicHeader />);
    const cta = screen.getByRole("link", { name: "Zaloguj się" });
    expect(cta).toHaveAttribute("href", "/login");
    expect(cta.className).toMatch(/bg-accent/);
  });

  it("renders the EN mirror when locale='en'", () => {
    render(<PublicHeader locale="en" />);
    expect(screen.getByRole("link", { name: "Pricing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Security" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("labels the FAQ page link 'FAQ' to match the landing menu (TLU-17)", () => {
    render(<PublicHeader />);
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
  });

  it("uses /en-prefixed hrefs on the EN locale (TLU-17)", () => {
    render(<PublicHeader locale="en" />);
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/en/pricing");
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute("href", "/en/security");
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "/en/blog");
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/en/faq");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
});
