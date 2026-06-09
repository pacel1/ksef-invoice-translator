import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OldWayComparison } from "@/components/landing/old-way-comparison";

describe("<OldWayComparison>", () => {
  it("renders the heading, the three problem actions, and the resolution (PL)", () => {
    render(<OldWayComparison locale="pl" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/Znamy to/);
    expect(screen.getByText("Wysyłasz polski PDF.")).toBeInTheDocument();
    expect(screen.getByText("Wrzucasz fakturę w Google Translate.")).toBeInTheDocument();
    expect(screen.getByText(/My tłumaczymy tylko język/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("renders the EN heading", () => {
    render(<OldWayComparison locale="en" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/We know that one/);
  });
});
