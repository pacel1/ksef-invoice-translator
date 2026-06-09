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
});
