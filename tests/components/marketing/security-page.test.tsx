import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SecurityPage } from "@/components/marketing/security-page";

describe("<SecurityPage>", () => {
  it("renders the hero headline (PL)", () => {
    render(<SecurityPage locale="pl" />);
    expect(screen.getByRole("heading", { level: 1, name: /Bezpieczeństwo i prywatność danych/i })).toBeInTheDocument();
  });

  it("renders the TL;DR section with all 4 items", () => {
    render(<SecurityPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /W skrócie/i })).toBeInTheDocument();
    expect(screen.getByText(/Wszystkie dane w UE/)).toBeInTheDocument();
    expect(screen.getByText(/Szyfrowanie/)).toBeInTheDocument();
  });

  it("renders the data flow diagram", () => {
    render(<SecurityPage locale="pl" />);
    expect(screen.getByText(/Twój komputer/)).toBeInTheDocument();
    expect(screen.getAllByText(/Supabase Frankfurt/).length).toBeGreaterThan(0);
  });

  it("renders the storage table", () => {
    render(<SecurityPage locale="pl" />);
    expect(screen.getByRole("columnheader", { name: /Czas przechowywania/i })).toBeInTheDocument();
    expect(screen.getByText(/30 dni od uploadu/i)).toBeInTheDocument();
  });

  it("renders the sub-processors table", () => {
    render(<SecurityPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /Sub-procesorzy/i })).toBeInTheDocument();
    expect(screen.getByText("Supabase")).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
  });

  it("renders the founder card", () => {
    render(<SecurityPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /Stoi za tym konkretny człowiek/i })).toBeInTheDocument();
  });

  it("renders the EN mirror", () => {
    render(<SecurityPage locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: /Data security and privacy/i })).toBeInTheDocument();
    expect(screen.getByText(/All data in the EU/)).toBeInTheDocument();
  });
});
