import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

import { FinalCta } from "@/components/landing/final-cta";

describe("<FinalCta>", () => {
  it("renders the heading and a CTA to /login (PL)", () => {
    render(<FinalCta locale="pl" />);
    expect(screen.getByRole("heading", { level: 2, name: /Wgraj pierwszą fakturę/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zacznij za darmo" })).toHaveAttribute("href", "/login");
  });

  it("renders the EN heading", () => {
    render(<FinalCta locale="en" />);
    expect(screen.getByRole("heading", { level: 2, name: /Upload your first invoice/i })).toBeInTheDocument();
  });
});
