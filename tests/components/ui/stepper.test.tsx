import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Stepper } from "@/components/ui/stepper";

/**
 * The <Stepper> primitive is the visible spine of the Tłumacz wizard
 * (spec §3.2). It must be a semantic `<nav><ol>` so screen readers can
 * announce "step 2 of 3", lets users navigate back to completed steps
 * but never forward, and renders without JS hydration (server component
 * friendly — no client-side state inside the component itself).
 */

const baseSteps = [
  { id: "upload", label: "Wybierz pliki" },
  { id: "language", label: "Język i format" },
  { id: "delivery", label: "Tłumaczenie" }
] as const;

describe("<Stepper>", () => {
  it("renders one <li> per step inside an ordered list", () => {
    render(<Stepper steps={[...baseSteps]} current="upload" />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
  });

  it("wraps the list in a <nav> with an accessible name", () => {
    render(
      <Stepper
        steps={[...baseSteps]}
        current="upload"
        ariaLabel="Postęp tłumaczenia"
      />
    );
    expect(
      screen.getByRole("navigation", { name: "Postęp tłumaczenia" })
    ).toBeInTheDocument();
  });

  it("marks only the current step with aria-current='step'", () => {
    render(<Stepper steps={[...baseSteps]} current="language" />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[2]).not.toHaveAttribute("aria-current");
  });

  it("renders the step number and label for each step", () => {
    render(<Stepper steps={[...baseSteps]} current="upload" />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Wybierz pliki")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Tłumaczenie")).toBeInTheDocument();
  });

  it("shows a checkmark on completed steps", () => {
    render(
      <Stepper
        steps={[...baseSteps]}
        current="delivery"
        completedIds={new Set(["upload", "language"])}
      />
    );
    // Two completed steps → two svg checkmarks rendered (lucide Check).
    const checks = screen.getAllByTestId("stepper-check");
    expect(checks).toHaveLength(2);
  });

  it("renders completed steps as buttons when onJumpBack is provided", () => {
    const onJumpBack = vi.fn();
    render(
      <Stepper
        steps={[...baseSteps]}
        current="delivery"
        completedIds={new Set(["upload", "language"])}
        onJumpBack={onJumpBack}
      />
    );
    // Completed steps clickable; current + future are not.
    expect(
      screen.getByRole("button", { name: /Wybierz pliki/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Język i format/i })
    ).toBeInTheDocument();
  });

  it("calls onJumpBack with the step id when a completed step is clicked", () => {
    const onJumpBack = vi.fn();
    render(
      <Stepper
        steps={[...baseSteps]}
        current="delivery"
        completedIds={new Set(["upload", "language"])}
        onJumpBack={onJumpBack}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Wybierz pliki/i }));
    expect(onJumpBack).toHaveBeenCalledTimes(1);
    expect(onJumpBack).toHaveBeenCalledWith("upload");
  });

  it("does not render the current or future steps as buttons", () => {
    const onJumpBack = vi.fn();
    render(
      <Stepper
        steps={[...baseSteps]}
        current="language"
        completedIds={new Set(["upload"])}
        onJumpBack={onJumpBack}
      />
    );
    // Current step "Język i format" → no button
    expect(
      screen.queryByRole("button", { name: /Język i format/i })
    ).not.toBeInTheDocument();
    // Future step "Tłumaczenie" → no button
    expect(
      screen.queryByRole("button", { name: /Tłumaczenie/i })
    ).not.toBeInTheDocument();
  });

  it("does not render completed steps as buttons when onJumpBack is omitted", () => {
    render(
      <Stepper
        steps={[...baseSteps]}
        current="delivery"
        completedIds={new Set(["upload", "language"])}
      />
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("applies cursor-pointer to clickable completed steps", () => {
    const onJumpBack = vi.fn();
    render(
      <Stepper
        steps={[...baseSteps]}
        current="delivery"
        completedIds={new Set(["upload"])}
        onJumpBack={onJumpBack}
      />
    );
    const button = screen.getByRole("button", { name: /Wybierz pliki/i });
    expect(button.className).toMatch(/cursor-pointer/);
  });
});
