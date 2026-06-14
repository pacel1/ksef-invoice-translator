import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

import { MobileNavSheet } from "@/components/landing/mobile-nav-sheet";

const links = [
  { href: "/pricing", label: "Cennik" },
  { href: "/security", label: "Bezpieczeństwo" }
];
const baseProps = { locale: "pl" as const, links, ctaHref: "/login", ctaLabel: "Zacznij za darmo", openLabel: "Otwórz menu", closeLabel: "Zamknij menu" };

describe("<MobileNavSheet>", () => {
  it("is collapsed by default with no links shown", () => {
    render(<MobileNavSheet {...baseProps} />);
    expect(screen.getByRole("button", { name: "Otwórz menu" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Cennik" })).not.toBeInTheDocument();
  });

  it("opens the sheet with links + CTA and moves focus to close", () => {
    render(<MobileNavSheet {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
    expect(screen.getByRole("link", { name: "Cennik" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Zacznij za darmo" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("button", { name: "Zamknij menu" })).toHaveFocus();
  });

  it("closes on link click", () => {
    render(<MobileNavSheet {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
    fireEvent.click(screen.getByRole("link", { name: "Cennik" }));
    expect(screen.queryByRole("link", { name: "Cennik" })).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<MobileNavSheet {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link", { name: "Cennik" })).not.toBeInTheDocument();
  });

  it("closes on backdrop click", () => {
    render(<MobileNavSheet {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
    fireEvent.click(screen.getByTestId("mobile-nav-backdrop"));
    expect(screen.queryByRole("link", { name: "Cennik" })).not.toBeInTheDocument();
  });

  it("gives the in-sheet links and CTA a visible focus ring (keyboard a11y)", () => {
    render(<MobileNavSheet {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
    expect(screen.getByRole("link", { name: "Cennik" }).className).toMatch(/focus-visible:ring-2/);
    expect(screen.getByRole("link", { name: "Zacznij za darmo" }).className).toMatch(/focus-visible:ring-2/);
  });
});
