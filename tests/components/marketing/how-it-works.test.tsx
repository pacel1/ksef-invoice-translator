import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HowItWorks } from "@/components/marketing/how-it-works";

const steps = [
  { title: "Wgraj fakturę", body: "Plik FA(3) XML z KSeF albo PDF." },
  { title: "Tłumaczymy treść", body: "20+ języków." },
  { title: "Pobierz MF-PDF", body: "Zgodny ze schematem 2025-06-25." }
];

describe("<HowItWorks>", () => {
  it("renders the eyebrow and the level-2 heading", () => {
    render(<HowItWorks eyebrow="Jak to działa" heading="Trzy kroki" steps={steps} />);
    expect(screen.getByText("Jak to działa")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Trzy kroki" })
    ).toBeInTheDocument();
  });

  it("renders one list item per step, numbered 1..n", () => {
    render(<HowItWorks eyebrow="x" heading="y" steps={steps} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders each step title (as h3) and body", () => {
    render(<HowItWorks eyebrow="x" heading="y" steps={steps} />);
    expect(
      screen.getByRole("heading", { level: 3, name: "Wgraj fakturę" })
    ).toBeInTheDocument();
    expect(screen.getByText("20+ języków.")).toBeInTheDocument();
  });
});
