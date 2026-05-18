import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCounter, STAT_COUNTER_THRESHOLD } from "@/components/trust/stat-counter";

describe("<StatCounter>", () => {
  it("exports a threshold of 50", () => {
    expect(STAT_COUNTER_THRESHOLD).toBe(50);
  });

  it("renders the value + label when value is at the threshold", () => {
    render(<StatCounter value={50} label="faktur" />);
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("faktur")).toBeInTheDocument();
  });

  it("renders the value + label when value is above the threshold", () => {
    render(<StatCounter value={1234} label="faktur" />);
    expect(screen.getByText("1234")).toBeInTheDocument();
  });

  it("returns null below the threshold", () => {
    const { container } = render(<StatCounter value={49} label="faktur" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null for non-positive values", () => {
    const { container } = render(<StatCounter value={0} label="faktur" />);
    expect(container).toBeEmptyDOMElement();
  });
});
