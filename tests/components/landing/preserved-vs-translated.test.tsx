import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreservedVsTranslated } from "@/components/landing/preserved-vs-translated";

describe("<PreservedVsTranslated>", () => {
  it("renders both column labels, a kept item, a translated item, and the trust line (PL)", () => {
    render(<PreservedVsTranslated locale="pl" />);
    expect(screen.getByRole("heading", { level: 2, name: /Zmienia się tylko język/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Zostaje bez zmian" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Tłumaczymy" })).toBeInTheDocument();
    expect(screen.getByText("Kod QR z KSeF")).toBeInTheDocument();
    expect(screen.getByText("Opisy towarów i usług")).toBeInTheDocument();
    expect(screen.getByText(/zgadza się z fakturą źródłową/)).toBeInTheDocument();
  });

  it("renders the EN labels", () => {
    render(<PreservedVsTranslated locale="en" />);
    expect(screen.getByRole("heading", { level: 3, name: "Stays unchanged" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "We translate" })).toBeInTheDocument();
  });
});
