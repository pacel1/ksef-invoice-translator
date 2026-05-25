import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OnboardingNameModal } from "@/components/account/onboarding-name-modal";

const updateProfileMock = vi.fn();
vi.mock("@/app/actions/profile", () => ({
  updateProfile: (input: unknown) => updateProfileMock(input)
}));

const labels = {
  title: "Imię i nazwisko zatwierdzającego tłumaczenie",
  body: "Dokumenty powinny…",
  firstNameLabel: "Imię",
  lastNameLabel: "Nazwisko",
  saveButton: "Zapisz",
  savingButton: "Zapisuję…",
  dismissButton: "Może później",
  errorMessage: "Nie udało się zapisać."
};

beforeEach(() => {
  window.localStorage.clear();
  updateProfileMock.mockReset();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("<OnboardingNameModal>", () => {
  it("renders nothing when names are present", () => {
    render(<OnboardingNameModal missing={false} labels={labels} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens once when names are missing and storage is clean", async () => {
    render(<OnboardingNameModal missing labels={labels} />);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("does NOT re-open after the user dismisses it once on this device", async () => {
    const { unmount } = render(
      <OnboardingNameModal missing labels={labels} />
    );
    await waitFor(() => screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("button", { name: /Może później/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    unmount();

    render(<OnboardingNameModal missing labels={labels} />);
    // Give the effect a tick. The dialog must NOT come back.
    await new Promise((r) => setTimeout(r, 5));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
