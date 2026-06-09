import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

import { SiteFooter } from "@/components/landing/site-footer";

describe("<SiteFooter>", () => {
  it("renders the legal note and product links (PL)", () => {
    render(<SiteFooter locale="pl" />);
    expect(screen.getByText(/Dane w UE \(Frankfurt\)/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cennik" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Polityka prywatności" })).toHaveAttribute("href", "/privacy");
  });

  it("renders the EN legal note", () => {
    render(<SiteFooter locale="en" />);
    expect(screen.getByText(/GDPR compliant/i)).toBeInTheDocument();
  });

  it("gives footer links a visible focus ring (keyboard a11y on the dark footer)", () => {
    render(<SiteFooter locale="pl" />);
    expect(screen.getByRole("link", { name: "Cennik" }).className).toMatch(/focus-visible:ring-2/);
  });
});
