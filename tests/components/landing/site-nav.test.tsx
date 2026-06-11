import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

import { SiteNav } from "@/components/landing/site-nav";

describe("<SiteNav>", () => {
  it("renders the brand wordmark and the desktop CTA to /login (PL)", () => {
    render(<SiteNav locale="pl" />);
    expect(screen.getByText("TłumaczKSeF")).toBeInTheDocument();
    const ctas = screen.getAllByRole("link", { name: "Zacznij za darmo" });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    expect(ctas[0]).toHaveAttribute("href", "/login");
  });

  it("renders the desktop nav links", () => {
    render(<SiteNav locale="pl" />);
    expect(screen.getByRole("link", { name: "Cennik" })).toHaveAttribute("href", "/pricing");
  });

  it("renders the EN CTA label", () => {
    render(<SiteNav locale="en" />);
    expect(screen.getAllByRole("link", { name: "Start free" })[0]).toHaveAttribute("href", "/login");
  });

  it("links FAQ to the FAQ page, not the landing section (TLU-16)", () => {
    render(<SiteNav locale="pl" />);
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
  });

  it("offers the same page destinations as the subpage header (TLU-17)", () => {
    render(<SiteNav locale="pl" />);
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "/blog");
  });

  it("uses /en-prefixed page links on the EN locale", () => {
    render(<SiteNav locale="en" />);
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/en/faq");
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "/en/blog");
  });

  it("gives the desktop nav links and CTA a visible focus ring (keyboard a11y)", () => {
    render(<SiteNav locale="pl" />);
    expect(screen.getByRole("link", { name: "Cennik" }).className).toMatch(/focus-visible:ring-2/);
    expect(screen.getAllByRole("link", { name: "Zacznij za darmo" })[0].className).toMatch(/focus-visible:ring-2/);
  });
});
