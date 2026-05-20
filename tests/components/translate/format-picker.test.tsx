import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormatPicker } from "@/components/translate/format-picker";

describe("<FormatPicker>", () => {
  it("renders both radio options with their help text", () => {
    render(
      <FormatPicker
        bilingual={false}
        onChange={vi.fn()}
        monoLabel="Tylko tłumaczenie"
        monoHelp="Faktura w jednym języku"
        bilingualLabel="Dwujęzycznie"
        bilingualHelp="Wybrany język + polski"
      />
    );
    expect(
      screen.getByRole("radio", { name: /Tylko tłumaczenie/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Dwujęzycznie/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Faktura w jednym języku")).toBeInTheDocument();
    expect(screen.getByText("Wybrany język + polski")).toBeInTheDocument();
  });

  it("reflects the bilingual flag in the checked radio", () => {
    const { rerender } = render(
      <FormatPicker
        bilingual={false}
        onChange={vi.fn()}
        monoLabel="Tylko tłumaczenie"
        monoHelp=""
        bilingualLabel="Dwujęzycznie"
        bilingualHelp=""
      />
    );
    expect(
      screen.getByRole("radio", { name: /Tylko tłumaczenie/i })
    ).toBeChecked();

    rerender(
      <FormatPicker
        bilingual={true}
        onChange={vi.fn()}
        monoLabel="Tylko tłumaczenie"
        monoHelp=""
        bilingualLabel="Dwujęzycznie"
        bilingualHelp=""
      />
    );
    expect(screen.getByRole("radio", { name: /Dwujęzycznie/i })).toBeChecked();
  });

  it("calls onChange(true) when the user picks bilingual", () => {
    const onChange = vi.fn();
    render(
      <FormatPicker
        bilingual={false}
        onChange={onChange}
        monoLabel="Tylko tłumaczenie"
        monoHelp=""
        bilingualLabel="Dwujęzycznie"
        bilingualHelp=""
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: /Dwujęzycznie/i }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange(false) when the user picks mono", () => {
    const onChange = vi.fn();
    render(
      <FormatPicker
        bilingual={true}
        onChange={onChange}
        monoLabel="Tylko tłumaczenie"
        monoHelp=""
        bilingualLabel="Dwujęzycznie"
        bilingualHelp=""
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: /Tylko tłumaczenie/i }));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
