import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/landing/ui/button";
import { Eyebrow } from "@/components/landing/ui/eyebrow";

describe("<Button>", () => {
  it("renders a button with its label and primary styling by default", () => {
    render(<Button>Zacznij</Button>);
    const btn = screen.getByRole("button", { name: "Zacznij" });
    expect(btn.className).toMatch(/bg-brand/);
  });

  it("renders an anchor when href is provided", () => {
    render(<Button href="/login">Zaloguj</Button>);
    const link = screen.getByRole("link", { name: "Zaloguj" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("applies the ghost variant", () => {
    render(<Button variant="ghost">Przykład</Button>);
    expect(screen.getByRole("button", { name: "Przykład" }).className).toMatch(/border/);
  });

  it("fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Klik</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Klik" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("<Eyebrow>", () => {
  it("renders its text", () => {
    render(<Eyebrow>Faktura KSeF</Eyebrow>);
    expect(screen.getByText("Faktura KSeF")).toBeInTheDocument();
  });
});
