import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

import { MobileNav } from "@/components/layout/mobile-nav";

const links = [
  { href: "/pricing", label: "Cennik" },
  { href: "/security", label: "Bezpieczeństwo" }
];
const cta = { href: "/login", label: "Zaloguj się" };
const baseProps = { links, cta, openLabel: "Otwórz menu", closeLabel: "Zamknij menu" };

describe("<MobileNav>", () => {
  it("renders a collapsed trigger with no links shown", () => {
    render(<MobileNav {...baseProps} />);
    const trigger = screen.getByRole("button", { name: "Otwórz menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Cennik" })).not.toBeInTheDocument();
  });

  it("opens a sheet with all links + CTA when the trigger is clicked", () => {
    render(<MobileNav {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
    expect(screen.getByRole("button", { name: "Zamknij menu" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cennik" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Bezpieczeństwo" })).toHaveAttribute("href", "/security");
    expect(screen.getByRole("link", { name: "Zaloguj się" })).toHaveAttribute("href", "/login");
  });

  it("closes when a navigation link is clicked", () => {
    render(<MobileNav {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
    fireEvent.click(screen.getByRole("link", { name: "Cennik" }));
    expect(screen.queryByRole("link", { name: "Cennik" })).not.toBeInTheDocument();
  });

  it("closes when the close button is clicked", () => {
    render(<MobileNav {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Zamknij menu" }));
    expect(screen.queryByRole("link", { name: "Cennik" })).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<MobileNav {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link", { name: "Cennik" })).not.toBeInTheDocument();
  });
});
