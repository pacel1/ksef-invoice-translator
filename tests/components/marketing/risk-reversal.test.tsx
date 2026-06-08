import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

import { RiskReversal } from "@/components/marketing/risk-reversal";

const items = [
  "1 faktura w miesiącu — gratis",
  "Bez karty, bez subskrypcji",
  "Niewykorzystane kredyty nie wygasają",
  "Zwrot pakietu w ciągu 14 dni"
];

describe("<RiskReversal>", () => {
  it("renders the eyebrow and the level-2 heading", () => {
    render(
      <RiskReversal
        eyebrow="Bez ryzyka"
        heading="Zacznij bez ryzyka."
        items={items}
        ctaText="Zacznij za darmo"
        ctaHref="/login"
      />
    );
    expect(screen.getByText("Bez ryzyka")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Zacznij bez ryzyka." })
    ).toBeInTheDocument();
  });

  it("renders one list item per promise", () => {
    render(
      <RiskReversal
        eyebrow="x"
        heading="y"
        items={items}
        ctaText="z"
        ctaHref="/login"
      />
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("renders the CTA as a link to ctaHref", () => {
    render(
      <RiskReversal
        eyebrow="x"
        heading="y"
        items={items}
        ctaText="Zacznij za darmo"
        ctaHref="/login"
      />
    );
    expect(screen.getByRole("link", { name: "Zacznij za darmo" })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});
