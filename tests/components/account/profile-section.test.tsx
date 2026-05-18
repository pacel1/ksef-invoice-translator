import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileSection } from "@/components/account/profile-section";

const updateProfileMock = vi.fn();

vi.mock("@/app/actions/profile", () => ({
  updateProfile: (input: unknown) => updateProfileMock(input)
}));

const baseProps = {
  email: "user@firma.pl",
  initialLocale: "pl" as const,
  initialDisplayName: "Jan Kowalski",
  labels: {
    heading: "Profil",
    emailLabel: "E-mail",
    emailHelp: "E-mail logowania nie można zmienić.",
    localeLabel: "Język interfejsu",
    displayNameLabel: "Nazwa wyświetlana (opcjonalnie)",
    displayNameHelp: "Używana w transakcyjnych e-mailach.",
    saveButton: "Zapisz zmiany",
    savingButton: "Zapisuję…",
    saveSuccess: "Zapisano.",
    saveError: "Nie udało się zapisać zmian."
  }
};

beforeEach(() => {
  updateProfileMock.mockReset();
});

describe("<ProfileSection>", () => {
  it("renders email as immutable monospace with help text", () => {
    render(<ProfileSection {...baseProps} />);
    expect(screen.getByText("user@firma.pl")).toBeInTheDocument();
    expect(screen.getByText(/E-mail logowania nie można zmienić/i)).toBeInTheDocument();
  });

  it("renders locale toggle preselected to PL", () => {
    render(<ProfileSection {...baseProps} />);
    const pl = screen.getByRole("radio", { name: /pl/i }) as HTMLInputElement;
    expect(pl.checked).toBe(true);
  });

  it("renders display-name field preloaded with the initial value", () => {
    render(<ProfileSection {...baseProps} />);
    const input = screen.getByLabelText(/Nazwa wyświetlana/i) as HTMLInputElement;
    expect(input.value).toBe("Jan Kowalski");
  });

  it("calls updateProfile with new locale + displayName on submit", async () => {
    updateProfileMock.mockResolvedValue({ ok: true });
    render(<ProfileSection {...baseProps} />);
    fireEvent.click(screen.getByRole("radio", { name: /en/i }));
    fireEvent.change(screen.getByLabelText(/Nazwa wyświetlana/i), {
      target: { value: "Anna Nowak" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Zapisz zmiany/i }));

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith({
        locale: "en",
        displayName: "Anna Nowak"
      });
    });
    await waitFor(() => {
      expect(screen.getByText(/Zapisano/)).toBeInTheDocument();
    });
  });

  it("shows error message on failure", async () => {
    updateProfileMock.mockResolvedValue({ ok: false, error: "boom" });
    render(<ProfileSection {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Zapisz zmiany/i }));
    await waitFor(() => {
      expect(screen.getByText(/Nie udało się zapisać zmian/i)).toBeInTheDocument();
    });
  });
});
