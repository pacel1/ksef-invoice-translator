import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

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
  });
});
