import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor
} from "@testing-library/react";
import { NameCaptureModal } from "@/components/account/name-capture-modal";

const updateProfileMock = vi.fn();

vi.mock("@/app/actions/profile", () => ({
  updateProfile: (input: unknown) => updateProfileMock(input)
}));

const baseLabels = {
  title: "Imię i nazwisko zatwierdzającego tłumaczenie",
  body: "Dokumenty powinny zawierać informację…",
  firstNameLabel: "Imię",
  lastNameLabel: "Nazwisko",
  saveButton: "Zapisz i kontynuuj",
  savingButton: "Zapisuję…",
  dismissButton: "Może później",
  errorMessage: "Nie udało się zapisać."
};

beforeEach(() => {
  updateProfileMock.mockReset();
});

describe("<NameCaptureModal>", () => {
  it("renders nothing when open=false", () => {
    render(
      <NameCaptureModal
        open={false}
        labels={baseLabels}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders title + body + both name inputs when open", () => {
    render(
      <NameCaptureModal
        open
        labels={baseLabels}
        onClose={vi.fn()}
      />
    );
    expect(
      screen.getByRole("dialog", {
        name: /Imię i nazwisko zatwierdzającego tłumaczenie/i
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Dokumenty powinny zawierać/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Imię$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nazwisko$/i)).toBeInTheDocument();
  });

  it("disables Save until both name fields are filled", () => {
    render(
      <NameCaptureModal open labels={baseLabels} onClose={vi.fn()} />
    );
    const save = screen.getByRole("button", { name: /Zapisz i kontynuuj/i });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Imię$/i), {
      target: { value: "Jan" }
    });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Nazwisko$/i), {
      target: { value: "Kowalski" }
    });
    expect(save).not.toBeDisabled();
  });

  it("submits trimmed first/last name to updateProfile + fires onSaved + onClose", async () => {
    updateProfileMock.mockResolvedValue({ ok: true });
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(
      <NameCaptureModal
        open
        labels={baseLabels}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
    fireEvent.change(screen.getByLabelText(/^Imię$/i), {
      target: { value: "  Jan  " }
    });
    fireEvent.change(screen.getByLabelText(/^Nazwisko$/i), {
      target: { value: "Kowalski" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Zapisz i kontynuuj/i }));

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith({
        firstName: "Jan",
        lastName: "Kowalski"
      });
    });
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("surfaces the error label when updateProfile fails", async () => {
    updateProfileMock.mockResolvedValue({ ok: false, error: "boom" });
    render(
      <NameCaptureModal open labels={baseLabels} onClose={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText(/^Imię$/i), {
      target: { value: "Jan" }
    });
    fireEvent.change(screen.getByLabelText(/^Nazwisko$/i), {
      target: { value: "Kowalski" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Zapisz i kontynuuj/i }));
    await waitFor(() => {
      expect(screen.getByText(/Nie udało się zapisać/i)).toBeInTheDocument();
    });
  });

  it("does NOT render a close button when dismissible=false (hard block)", () => {
    render(
      <NameCaptureModal
        open
        dismissible={false}
        labels={baseLabels}
        onClose={vi.fn()}
      />
    );
    expect(
      screen.queryByRole("button", { name: /Może później/i })
    ).toBeNull();
  });
});
