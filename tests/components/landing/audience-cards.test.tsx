import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AudienceCards } from "@/components/landing/audience-cards";

describe("<AudienceCards>", () => {
  it("renders the heading and both lane titles (PL)", () => {
    render(<AudienceCards locale="pl" />);
    expect(screen.getByRole("heading", { level: 2, name: /czy masz jedną fakturę, czy sto/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Prowadzisz firmę i sprzedajesz za granicę" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Prowadzisz biuro rachunkowe" })).toBeInTheDocument();
  });

  it("renders the EN lane titles", () => {
    render(<AudienceCards locale="en" />);
    expect(screen.getByRole("heading", { level: 3, name: "You run a business and sell abroad" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "You run an accounting office" })).toBeInTheDocument();
  });
});
