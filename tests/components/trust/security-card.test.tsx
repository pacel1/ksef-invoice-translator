import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SecurityCard } from "@/components/trust/security-card";

const baseProps = {
  title: "Bezpieczeństwo Twoich faktur",
  items: [
    "Dane przechowywane w Supabase Frankfurt",
    "Szyfrowanie w trakcie i w spoczynku",
    "Kasowanie faktur po 30 dniach",
    "RODO-compliant"
  ]
};

describe("<SecurityCard>", () => {
  it("renders the title and all bullet items", () => {
    render(<SecurityCard {...baseProps} />);
    expect(screen.getByRole("heading", { name: /Bezpieczeństwo Twoich faktur/i })).toBeInTheDocument();
    for (const item of baseProps.items) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it("renders a green check icon next to each bullet", () => {
    render(<SecurityCard {...baseProps} />);
    const icons = document.querySelectorAll("[data-security-check]");
    expect(icons.length).toBe(baseProps.items.length);
  });

  it("renders an empty state with no items", () => {
    render(<SecurityCard title="Tytuł" items={[]} />);
    expect(screen.getByRole("heading", { name: "Tytuł" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-security-check]").length).toBe(0);
  });
});
