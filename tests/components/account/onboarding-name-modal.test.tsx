import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OnboardingNameModal } from "@/components/account/onboarding-name-modal";

const captureClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  captureClient: captureClientMock,
  captureClientError: vi.fn()
}));

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
  captureClientMock.mockClear();
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

describe("<OnboardingNameModal> analytics", () => {
  it("captures onboarding_name_shown when the modal opens for a user missing a name", async () => {
    render(<OnboardingNameModal missing labels={labels} />);
    await waitFor(() => {
      expect(captureClientMock).toHaveBeenCalledWith("onboarding_name_shown", {});
    });
  });

  it("does not capture shown when the name is already present", async () => {
    render(<OnboardingNameModal missing={false} labels={labels} />);
    // Give the effect a tick — nothing should fire.
    await new Promise((r) => setTimeout(r, 5));
    expect(captureClientMock).not.toHaveBeenCalledWith(
      "onboarding_name_shown",
      {}
    );
  });

  it("does not capture shown when the device has already seen the dialog", async () => {
    window.localStorage.setItem("name-capture-onboarding-seen", "1");
    render(<OnboardingNameModal missing labels={labels} />);
    await new Promise((r) => setTimeout(r, 5));
    expect(captureClientMock).not.toHaveBeenCalledWith(
      "onboarding_name_shown",
      {}
    );
  });

  it("captures onboarding_name_completed on a successful save (onSaved path)", async () => {
    updateProfileMock.mockResolvedValue({ ok: true });
    render(<OnboardingNameModal missing labels={labels} />);
    await waitFor(() => screen.getByRole("dialog"));

    fireEvent.change(screen.getByLabelText("Imię"), {
      target: { value: "Jan" }
    });
    fireEvent.change(screen.getByLabelText("Nazwisko"), {
      target: { value: "Kowalski" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));

    await waitFor(() => {
      expect(captureClientMock).toHaveBeenCalledWith(
        "onboarding_name_completed",
        {}
      );
    });
  });

  it("does not capture completed when the dialog is merely dismissed", async () => {
    render(<OnboardingNameModal missing labels={labels} />);
    await waitFor(() => screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("button", { name: /Może później/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(captureClientMock).not.toHaveBeenCalledWith(
      "onboarding_name_completed",
      {}
    );
  });
});
