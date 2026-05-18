import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthenticatedHeader } from "@/components/layout/authenticated-header";

// next/link is fine under jsdom. The chip is a child component we render directly.
const balanceChip = <span data-testid="balance-chip-mock">25 kredytów</span>;
const signOutAction = vi.fn();

describe("<AuthenticatedHeader>", () => {
  it("renders the brand lockup linking to /app", () => {
    render(
      <AuthenticatedHeader email="jane@firma.pl" balanceSlot={balanceChip} signOutAction={signOutAction} />
    );
    expect(screen.getByRole("link", { name: /Tłumacz Faktur KSeF/i })).toHaveAttribute("href", "/app");
  });

  it("renders Workspace + Historia nav links", () => {
    render(
      <AuthenticatedHeader email="jane@firma.pl" balanceSlot={balanceChip} signOutAction={signOutAction} />
    );
    expect(screen.getByRole("link", { name: "Workspace" })).toHaveAttribute("href", "/app");
    expect(screen.getByRole("link", { name: "Historia" })).toHaveAttribute("href", "/app/history");
  });

  it("renders the balance slot, email, and logout button", () => {
    render(
      <AuthenticatedHeader email="jane@firma.pl" balanceSlot={balanceChip} signOutAction={signOutAction} />
    );
    expect(screen.getByTestId("balance-chip-mock")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "jane@firma.pl" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("button", { name: /Wyloguj/i })).toBeInTheDocument();
  });
});
