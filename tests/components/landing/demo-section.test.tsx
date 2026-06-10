import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DemoSection } from "@/components/landing/demo/demo-section";

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}

beforeEach(() => mockMatchMedia(false));

describe("<DemoSection>", () => {
  it("renders the dark demo stage with the heading and the default English invoice", () => {
    render(<DemoSection locale="pl" />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Zobacz swoją fakturę w innym języku" })
    ).toBeInTheDocument();
    expect(screen.getByText('Oak chair „Helena”')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
  });

  it("re renders the invoice in the chosen language when a chip is clicked", () => {
    render(<DemoSection locale="pl" />);
    fireEvent.click(screen.getByRole("button", { name: "DE" }));
    expect(screen.getByText('Eichenstuhl „Helena”')).toBeInTheDocument();
    expect(screen.queryByText('Oak chair „Helena”')).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "DE" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens the download gate when the primary CTA is clicked", () => {
    render(<DemoSection locale="pl" />);
    expect(screen.queryByLabelText("Adres e-mail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pobierz PDF" }));
    expect(screen.getByLabelText("Adres e-mail")).toBeInTheDocument();
  });
});
