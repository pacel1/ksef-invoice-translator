import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguagePills } from "@/components/workspace/language-pills";
import type { LanguageCode } from "@/types/invoice";

const baseProps = {
  current: "en" as const,
  cached: new Set<LanguageCode>(["en"]),
  translating: false,
  onSelect: vi.fn(),
  cachedLabel: "cached",
  moreLanguagesLabel: "More languages",
  originalPolishLabel: "Polish",
  allLanguageOptions: [
    { code: "en" as const, label: "English" },
    { code: "de" as const, label: "German" },
    { code: "fr" as const, label: "French" },
    { code: "es" as const, label: "Spanish" },
    { code: "it" as const, label: "Italian" },
    { code: "nl" as const, label: "Dutch" }
  ]
};

describe("<LanguagePills>", () => {
  it("renders the 5 default visible pills + the 'more' overflow", () => {
    render(<LanguagePills {...baseProps} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^EN/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^DE/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^FR/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ES/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^IT/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /More languages/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^NL/ })).not.toBeInTheDocument();
  });

  it("marks the current pill with aria-pressed", () => {
    render(<LanguagePills {...baseProps} onSelect={vi.fn()} />);
    const en = screen.getByRole("button", { name: /^EN/ });
    expect(en.getAttribute("aria-pressed")).toBe("true");
    const de = screen.getByRole("button", { name: /^DE/ });
    expect(de.getAttribute("aria-pressed")).toBe("false");
  });

  it("calls onSelect with the language code when a pill is clicked", () => {
    const onSelect = vi.fn();
    render(<LanguagePills {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /^DE/ }));
    expect(onSelect).toHaveBeenCalledWith("de");
  });

  it("shows a spinner on the current pill when translating", () => {
    render(<LanguagePills {...baseProps} translating={true} onSelect={vi.fn()} />);
    const en = screen.getByRole("button", { name: /^EN/ });
    expect(en.querySelector('[data-testid="pill-spinner"]')).not.toBeNull();
  });

  it("renders cached indicator only on cached pills", () => {
    const cached = new Set<LanguageCode>(["en", "fr"]);
    render(<LanguagePills {...baseProps} cached={cached} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^EN/ }).getAttribute("data-cached")).toBe("true");
    expect(screen.getByRole("button", { name: /^DE/ }).getAttribute("data-cached")).toBe("false");
    expect(screen.getByRole("button", { name: /^FR/ }).getAttribute("data-cached")).toBe("true");
  });

  it("opens the more-languages popover and selects a language from it", () => {
    const onSelect = vi.fn();
    render(<LanguagePills {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /More languages/i }));
    const nl = screen.getByRole("option", { name: /Dutch/i });
    fireEvent.click(nl);
    expect(onSelect).toHaveBeenCalledWith("nl");
  });

  it("renders a leading PL pill that calls onSelect('pl') when clicked", () => {
    const onSelect = vi.fn();
    render(<LanguagePills {...baseProps} onSelect={onSelect} />);
    const pl = screen.getByRole("button", { name: /^PL/ });
    expect(pl).toBeInTheDocument();
    expect(pl.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(pl);
    expect(onSelect).toHaveBeenCalledWith("pl");
  });

  it("PL pill is aria-pressed when current is 'pl'", () => {
    render(<LanguagePills {...baseProps} current="pl" onSelect={vi.fn()} />);
    const pl = screen.getByRole("button", { name: /^PL/ });
    expect(pl.getAttribute("aria-pressed")).toBe("true");
    const en = screen.getByRole("button", { name: /^EN/ });
    expect(en.getAttribute("aria-pressed")).toBe("false");
  });
});
