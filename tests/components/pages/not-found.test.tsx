import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "@/app/not-found";

describe("app/not-found.tsx", () => {
  it("renders 404 + title + body + back-home CTA (PL)", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Nie znaleziono/i })).toBeInTheDocument();
    expect(screen.getByText(/nie istnieje albo została przeniesiona/i)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /Wracam na stronę główną/i });
    expect(cta).toHaveAttribute("href", "/");
  });

  it("renders the brand lockup linking to /", () => {
    render(<NotFound />);
    const lockup = screen.getByRole("link", { name: /Tłumacz Faktur KSeF/i });
    expect(lockup).toHaveAttribute("href", "/");
  });

  it("renders the LegalFooter", () => {
    render(<NotFound />);
    expect(screen.getByText(/NIP/i)).toBeInTheDocument();
  });
});
