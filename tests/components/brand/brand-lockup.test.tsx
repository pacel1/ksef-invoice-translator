import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandLockup } from "@/components/brand/brand-lockup";

describe("<BrandLockup>", () => {
  it("renders the sygnet bug + wordmark by default", () => {
    render(<BrandLockup />);
    expect(screen.getByText("Tłumacz Faktur KSeF")).toBeInTheDocument();
    const bug = document.querySelector("[data-brand-bug]");
    expect(bug).toBeInTheDocument();
    expect(bug?.tagName).toBe("IMG");
    expect(bug).toHaveAttribute("src", "/brand/sygnet.svg");
  });

  it("wraps the lockup in a link when href is provided", () => {
    render(<BrandLockup href="/app" />);
    const link = screen.getByRole("link", { name: /Tłumacz Faktur KSeF/i });
    expect(link).toHaveAttribute("href", "/app");
  });

  it("renders bug only when variant='bug-only'", () => {
    render(<BrandLockup variant="bug-only" />);
    expect(screen.queryByText("Tłumacz Faktur KSeF")).not.toBeInTheDocument();
    expect(document.querySelector("[data-brand-bug]")).toHaveAttribute("src", "/brand/sygnet.svg");
  });

  it("applies size classes for sm | md | lg", () => {
    const { rerender } = render(<BrandLockup size="sm" />);
    expect(document.querySelector("[data-brand-bug]")?.className).toMatch(/h-6/);
    rerender(<BrandLockup size="lg" />);
    expect(document.querySelector("[data-brand-bug]")?.className).toMatch(/h-10/);
  });
});
