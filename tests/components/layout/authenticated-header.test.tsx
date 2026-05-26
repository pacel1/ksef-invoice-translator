import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthenticatedHeader } from "@/components/layout/authenticated-header";

const balanceChip = <span data-testid="balance-chip-mock">25 kredytów</span>;
const signOutAction = vi.fn();

describe("<AuthenticatedHeader>", () => {
  it("renders the brand lockup linking to /app", () => {
    render(
      <AuthenticatedHeader
        email="jane@firma.pl"
        balanceSlot={balanceChip}
        signOutAction={signOutAction}
        labels={{ workspace: "Workspace", history: "Historia", signOut: "Wyloguj" }}
      />
    );
    expect(
      screen.getByRole("link", { name: /Tłumacz Faktur KSeF/i })
    ).toHaveAttribute("href", "/app");
  });

  it("renders the Polish nav labels when given the PL label set", () => {
    render(
      <AuthenticatedHeader
        email="jane@firma.pl"
        balanceSlot={balanceChip}
        signOutAction={signOutAction}
        labels={{ workspace: "Workspace", history: "Historia", signOut: "Wyloguj" }}
      />
    );
    expect(screen.getByRole("link", { name: "Workspace" })).toHaveAttribute(
      "href",
      "/app"
    );
    expect(screen.getByRole("link", { name: "Historia" })).toHaveAttribute(
      "href",
      "/app/history"
    );
    expect(screen.getByRole("button", { name: "Wyloguj" })).toBeInTheDocument();
  });

  it("renders the English nav labels when given the EN label set", () => {
    render(
      <AuthenticatedHeader
        email="jane@firma.pl"
        balanceSlot={balanceChip}
        signOutAction={signOutAction}
        labels={{ workspace: "Workspace", history: "History", signOut: "Log out" }}
      />
    );
    expect(screen.getByRole("link", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute(
      "href",
      "/app/history"
    );
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("renders the balance slot and email link", () => {
    render(
      <AuthenticatedHeader
        email="jane@firma.pl"
        balanceSlot={balanceChip}
        signOutAction={signOutAction}
        labels={{ workspace: "Workspace", history: "Historia", signOut: "Wyloguj" }}
      />
    );
    expect(screen.getByTestId("balance-chip-mock")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "jane@firma.pl" })).toHaveAttribute(
      "href",
      "/account"
    );
  });
});
