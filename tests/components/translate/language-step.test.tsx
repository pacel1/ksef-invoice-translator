import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageStep } from "@/components/translate/language-step";
import { copy } from "@/lib/workspace/copy";

const t = copy.pl;

const baseProps = {
  uiLanguage: "pl" as const,
  copy: t,
  language: null,
  bilingual: false,
  cost: 1,
  balance: 5,
  onSetLanguage: vi.fn(),
  onSetBilingual: vi.fn(),
  onBack: vi.fn(),
  onTranslate: vi.fn(async () => undefined)
};

describe("<LanguageStep>", () => {
  it("renders the heading with the file count", () => {
    render(<LanguageStep {...baseProps} cost={3} />);
    expect(screen.getByText(/^Dla 3 faktur$/)).toBeInTheDocument();
  });

  it("renders the language picker + format picker + cost preview", () => {
    render(<LanguageStep {...baseProps} />);
    expect(screen.getByTestId("language-picker")).toBeInTheDocument();
    expect(screen.getByTestId("format-picker")).toBeInTheDocument();
    expect(screen.getByTestId("cost-preview")).toBeInTheDocument();
  });

  it("disables the Translate CTA when no language is picked", () => {
    render(<LanguageStep {...baseProps} language={null} />);
    const cta = screen.getByRole("button", { name: /Tłumacz/i });
    expect(cta).toBeDisabled();
  });

  it("enables the Translate CTA when language is set and balance covers cost", () => {
    render(<LanguageStep {...baseProps} language="de" cost={2} balance={5} />);
    const cta = screen.getByRole("button", { name: /Tłumacz/i });
    expect(cta).not.toBeDisabled();
  });

  it("swaps the CTA to 'Doładuj kredyty' when balance < cost", () => {
    render(<LanguageStep {...baseProps} language="de" cost={10} balance={3} />);
    expect(
      screen.getByRole("link", { name: /Doładuj kredyty/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Tłumacz/i })).toBeNull();
  });

  it("invokes onBack when the user clicks Wstecz", () => {
    const onBack = vi.fn();
    render(<LanguageStep {...baseProps} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /Wstecz/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("invokes onTranslate when the user clicks Tłumacz", () => {
    const onTranslate = vi.fn(async () => undefined);
    render(
      <LanguageStep
        {...baseProps}
        language="en"
        cost={2}
        balance={5}
        onTranslate={onTranslate}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Tłumacz/i }));
    expect(onTranslate).toHaveBeenCalledTimes(1);
  });
});
