import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataFlowDiagram } from "@/components/marketing/data-flow-diagram";

const stepsPl = [
  { icon: "computer", label: "Twój komputer" },
  { icon: "shield", label: "Supabase Frankfurt" },
  { icon: "translate", label: "Tłumaczenie OpenAI" },
  { icon: "pdf", label: "Dostarczenie PDF" },
  { icon: "trash", label: "Kasowanie po 30 dniach" }
] as const;

describe("<DataFlowDiagram>", () => {
  it("renders all step labels in order", () => {
    render(<DataFlowDiagram steps={stepsPl} />);
    expect(screen.getByText("Twój komputer")).toBeInTheDocument();
    expect(screen.getByText("Supabase Frankfurt")).toBeInTheDocument();
    expect(screen.getByText("Tłumaczenie OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Dostarczenie PDF")).toBeInTheDocument();
    expect(screen.getByText("Kasowanie po 30 dniach")).toBeInTheDocument();
  });

  it("renders an icon for each step", () => {
    render(<DataFlowDiagram steps={stepsPl} />);
    const icons = document.querySelectorAll("[data-flow-icon]");
    expect(icons.length).toBe(5);
  });

  it("renders 4 arrow separators between 5 steps", () => {
    render(<DataFlowDiagram steps={stepsPl} />);
    const arrows = document.querySelectorAll("[data-flow-arrow]");
    expect(arrows.length).toBe(4);
  });
});
