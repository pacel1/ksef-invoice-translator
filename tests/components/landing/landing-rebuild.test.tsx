import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn()
  }));
});

import { LandingRebuild } from "@/components/landing/landing-rebuild";

describe("<LandingRebuild>", () => {
  it("renders the nav, final CTA, footer, and the section anchors", () => {
    const { container } = render(<LandingRebuild locale="pl" />);
    expect(screen.getAllByText("TłumaczKSeF").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("heading", { level: 2, name: /Wgraj pierwszą fakturę/i })).toBeInTheDocument();
    expect(screen.getByText(/Dane w UE \(Frankfurt\)/i)).toBeInTheDocument();
    // section placeholder anchors exist for later sprints
    expect(container.querySelector("#jak-to-dziala")).not.toBeNull();
    expect(container.querySelector("#faq")).not.toBeNull();
    // hero is now real content (level-1 headline), not an empty placeholder
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Znowu przepisujesz fakturę/);
    // the four explainer sections now render real content (their level-2 headings)
    expect(screen.getByRole("heading", { level: 2, name: /Trzy kroki/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Zmienia się tylko język/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /czy masz jedną fakturę/ })).toBeInTheDocument();
    // pricing + faq now render real content
    expect(screen.getByRole("heading", { level: 2, name: /Płacisz tylko za faktury/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Najczęstsze pytania/ })).toBeInTheDocument();
  });
});
