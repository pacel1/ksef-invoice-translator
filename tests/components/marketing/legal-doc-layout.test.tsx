import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LegalDocLayout } from "@/components/marketing/legal-doc-layout";

const props = {
  title: "Regulamin",
  lastUpdatedLabel: "Ostatnia aktualizacja",
  lastUpdatedDate: "2026-05-18",
  tocHeading: "Spis treści",
  sections: [
    { id: "wstep", title: "Wstęp", content: "Treść wstępu." },
    { id: "definicje", title: "Definicje", content: "Treść definicji." }
  ]
};

describe("<LegalDocLayout>", () => {
  it("renders title and last-updated metadata", () => {
    render(<LegalDocLayout {...props} />);
    expect(screen.getByRole("heading", { level: 1, name: /Regulamin/i })).toBeInTheDocument();
    expect(screen.getByText(/Ostatnia aktualizacja/)).toBeInTheDocument();
    expect(screen.getByText(/2026-05-18/)).toBeInTheDocument();
  });

  it("renders the TOC with section links", () => {
    render(<LegalDocLayout {...props} />);
    expect(screen.getByRole("heading", { name: /Spis treści/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wstęp" })).toHaveAttribute("href", "#wstep");
    expect(screen.getByRole("link", { name: "Definicje" })).toHaveAttribute("href", "#definicje");
  });

  it("renders each section with an id anchor", () => {
    render(<LegalDocLayout {...props} />);
    expect(document.getElementById("wstep")).not.toBeNull();
    expect(document.getElementById("definicje")).not.toBeNull();
    expect(screen.getByText("Treść wstępu.")).toBeInTheDocument();
  });
});
