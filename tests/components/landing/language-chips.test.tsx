import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageChips } from "@/components/landing/demo/language-chips";

describe("<LanguageChips>", () => {
  it("renders a button per demo language and marks the active one", () => {
    render(<LanguageChips value="en" onChange={() => {}} label="Language" />);
    for (const code of ["EN", "DE", "FR", "ES", "IT", "CS"]) {
      expect(screen.getByRole("button", { name: code })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "DE" })).toHaveAttribute("aria-pressed", "false");
  });

  it("fires onChange with the chosen language code", () => {
    const onChange = vi.fn();
    render(<LanguageChips value="en" onChange={onChange} label="Language" />);
    fireEvent.click(screen.getByRole("button", { name: "DE" }));
    expect(onChange).toHaveBeenCalledWith("de");
  });
});
