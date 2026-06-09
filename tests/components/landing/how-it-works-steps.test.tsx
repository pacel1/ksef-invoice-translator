import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HowItWorksSteps } from "@/components/landing/how-it-works-steps";

describe("<HowItWorksSteps>", () => {
  it("renders the heading, three numbered steps, and the footnote (PL)", () => {
    render(<HowItWorksSteps locale="pl" />);
    expect(screen.getByRole("heading", { level: 2, name: /Trzy kroki/ })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Wybierz język klienta." })).toBeInTheDocument();
    expect(screen.getByText("Bez instalacji, bez integracji, bez umów.")).toBeInTheDocument();
  });

  it("renders the EN heading", () => {
    render(<HowItWorksSteps locale="en" />);
    expect(screen.getByRole("heading", { level: 2, name: /Three steps/ })).toBeInTheDocument();
  });
});
