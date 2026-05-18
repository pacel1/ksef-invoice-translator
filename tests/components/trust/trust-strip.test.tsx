import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrustStrip } from "@/components/trust/trust-strip";

describe("<TrustStrip>", () => {
  it("renders all five trust badges (PL default)", () => {
    render(<TrustStrip />);
    expect(screen.getByText("Stripe")).toBeInTheDocument();
    expect(screen.getByText(/Supabase/i)).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("RODO")).toBeInTheDocument();
    expect(screen.getByText(/MF FA\(3\)/)).toBeInTheDocument();
  });

  it("renders an aria-label for the strip", () => {
    render(<TrustStrip />);
    expect(screen.getByRole("list", { name: /Zaufane technologie/i })).toBeInTheDocument();
  });

  it("switches to EN locale labels", () => {
    render(<TrustStrip locale="en" />);
    expect(screen.getByText("GDPR")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /Trusted tech/i })).toBeInTheDocument();
  });
});
