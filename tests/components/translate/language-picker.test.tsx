import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguagePicker } from "@/components/translate/language-picker";

describe("<LanguagePicker>", () => {
  it("renders the four quick-pick chips (EN/DE/FR/ES) at top", () => {
    render(
      <LanguagePicker
        uiLanguage="pl"
        value={null}
        onSelect={vi.fn()}
        searchPlaceholder="Szukaj…"
        showAllLabel="Pokaż wszystkie 22"
        polishLockedLabel="Polski jest źródłem"
      />
    );
    expect(screen.getByRole("button", { name: /^EN/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^DE/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^FR/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ES/ })).toBeInTheDocument();
  });

  it("calls onSelect when the user clicks a quick chip", () => {
    const onSelect = vi.fn();
    render(
      <LanguagePicker
        uiLanguage="pl"
        value={null}
        onSelect={onSelect}
        searchPlaceholder="Szukaj…"
        showAllLabel="Pokaż wszystkie 22"
        polishLockedLabel="Polski jest źródłem"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^DE/ }));
    expect(onSelect).toHaveBeenCalledWith("de");
  });

  it("marks the currently-selected chip as aria-pressed", () => {
    render(
      <LanguagePicker
        uiLanguage="pl"
        value="de"
        onSelect={vi.fn()}
        searchPlaceholder="Szukaj…"
        showAllLabel="Pokaż wszystkie 22"
        polishLockedLabel="Polski jest źródłem"
      />
    );
    expect(screen.getByRole("button", { name: /^DE/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /^EN/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("expands a full list when the user clicks 'Pokaż wszystkie'", () => {
    render(
      <LanguagePicker
        uiLanguage="pl"
        value={null}
        onSelect={vi.fn()}
        searchPlaceholder="Szukaj…"
        showAllLabel="Pokaż wszystkie 22"
        polishLockedLabel="Polski jest źródłem"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Pokaż wszystkie 22/ }));
    // Once expanded, Hungarian (HU) should be visible — not in quick chips.
    expect(screen.getByRole("option", { name: /węgierski/i })).toBeInTheDocument();
  });

  it("never lists Polish as a target option (it's the source)", () => {
    render(
      <LanguagePicker
        uiLanguage="pl"
        value={null}
        onSelect={vi.fn()}
        searchPlaceholder="Szukaj…"
        showAllLabel="Pokaż wszystkie 22"
        polishLockedLabel="Polski jest źródłem"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Pokaż wszystkie 22/ }));
    expect(screen.queryByRole("option", { name: /^polski$/i })).toBeNull();
  });

  it("filters the expanded list as the user types in the search input", () => {
    render(
      <LanguagePicker
        uiLanguage="pl"
        value={null}
        onSelect={vi.fn()}
        searchPlaceholder="Szukaj…"
        showAllLabel="Pokaż wszystkie 22"
        polishLockedLabel="Polski jest źródłem"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Pokaż wszystkie 22/ }));
    const input = screen.getByPlaceholderText("Szukaj…");
    fireEvent.change(input, { target: { value: "niem" } });
    // German ("niemiecki") survives; Hungarian doesn't.
    expect(screen.getByRole("option", { name: /niemiecki/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /węgierski/i })).toBeNull();
  });
});
