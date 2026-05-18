import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "@/app/login/login-form";

const baseCopy = {
  emailLabel: "Adres e-mail",
  emailPlaceholder: "twoj@adres.pl",
  submitButton: "Wyślij link logowania",
  sendingButton: "Wysyłam link…",
  sentTitle: "Sprawdź skrzynkę",
  sentBodyPrefix: "Link logowania wysłany na",
  sentResend: "Wyślij ponownie",
  errorGeneric: "Nie udało się wysłać linku. Spróbuj ponownie.",
  errorRateLimited: "Za dużo prób."
};

const signInWithOtpMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithOtp: signInWithOtpMock }
  })
}));

beforeEach(() => {
  signInWithOtpMock.mockReset();
});

afterEach(() => {
  signInWithOtpMock.mockReset();
});

describe("<LoginForm>", () => {
  it("renders email input + submit button (idle state)", () => {
    render(<LoginForm copy={baseCopy} />);
    expect(screen.getByLabelText(/Adres e-mail/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Wyślij link logowania/i })).toBeInTheDocument();
  });

  it("calls Supabase signInWithOtp on submit and shows sent state", async () => {
    signInWithOtpMock.mockResolvedValue({ error: null });
    render(<LoginForm copy={baseCopy} />);
    fireEvent.change(screen.getByLabelText(/Adres e-mail/i), {
      target: { value: "test@firma.pl" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Wyślij link logowania/i }));
    await waitFor(() => {
      expect(signInWithOtpMock).toHaveBeenCalledTimes(1);
    });
    expect(signInWithOtpMock.mock.calls[0][0].email).toBe("test@firma.pl");
    await waitFor(() => {
      expect(screen.getByText(/Sprawdź skrzynkę/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/test@firma\.pl/)).toBeInTheDocument();
  });

  it("shows the generic error when Supabase returns an error", async () => {
    signInWithOtpMock.mockResolvedValue({ error: { message: "boom", status: 500 } });
    render(<LoginForm copy={baseCopy} />);
    fireEvent.change(screen.getByLabelText(/Adres e-mail/i), {
      target: { value: "test@firma.pl" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Wyślij link logowania/i }));
    await waitFor(() => {
      expect(screen.getByText(/Nie udało się wysłać linku/i)).toBeInTheDocument();
    });
  });

  it("shows the rate-limit message when Supabase returns 429", async () => {
    signInWithOtpMock.mockResolvedValue({ error: { message: "rate", status: 429 } });
    render(<LoginForm copy={baseCopy} />);
    fireEvent.change(screen.getByLabelText(/Adres e-mail/i), {
      target: { value: "test@firma.pl" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Wyślij link logowania/i }));
    await waitFor(() => {
      expect(screen.getByText(/Za dużo prób/i)).toBeInTheDocument();
    });
  });
});
