import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FaqAccordion } from "@/components/landing/faq-accordion";

describe("<FaqAccordion>", () => {
  it("renders the heading and all six question/answer pairs as details (PL)", () => {
    const { container } = render(<FaqAccordion locale="pl" />);
    expect(screen.getByRole("heading", { level: 2, name: /Najczęstsze pytania/ })).toBeInTheDocument();
    expect(container.querySelectorAll("details")).toHaveLength(6);
    expect(screen.getByText("Co z kodem QR?")).toBeInTheDocument();
    expect(screen.getByText(/Pliki trzymamy w UE/)).toBeInTheDocument();
  });

  it("renders the EN heading", () => {
    render(<FaqAccordion locale="en" />);
    expect(screen.getByRole("heading", { level: 2, name: /Frequent questions/ })).toBeInTheDocument();
  });
});
