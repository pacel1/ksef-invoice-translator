// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const captureClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  captureClient: captureClientMock,
  captureClientError: vi.fn()
}));

const searchParamsMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => searchParamsMock }));

// The login form talks to Supabase on user interaction; stub the browser
// client so importing/rendering the component never reaches the network.
vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithOtp: vi.fn(), signInWithOAuth: vi.fn() }
  })
}));

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
  errorRateLimited: "Za dużo prób.",
  googleButton: "Kontynuuj przez Google",
  divider: "albo",
  googleError: "Nie udało się połączyć z Google."
};

describe("LoginForm auth_failed", () => {
  beforeEach(() => {
    captureClientMock.mockClear();
    searchParamsMock.get.mockReset();
  });

  it("captures auth_failed once when ?error is present", () => {
    searchParamsMock.get.mockReturnValue("otp_expired");
    render(<LoginForm copy={baseCopy} />);
    expect(captureClientMock).toHaveBeenCalledWith("auth_failed", { reason: "otp_expired" });
    const authFailedCalls = captureClientMock.mock.calls.filter(([name]) => name === "auth_failed");
    expect(authFailedCalls).toHaveLength(1);
  });

  it("does not capture auth_failed when no error param", () => {
    searchParamsMock.get.mockReturnValue(null);
    render(<LoginForm copy={baseCopy} />);
    expect(captureClientMock).not.toHaveBeenCalledWith("auth_failed", expect.anything());
  });

  it("caps an overlong reason to 64 characters", () => {
    const longReason = "x".repeat(200);
    searchParamsMock.get.mockReturnValue(longReason);
    render(<LoginForm copy={baseCopy} />);
    expect(captureClientMock).toHaveBeenCalledWith("auth_failed", {
      reason: "x".repeat(64)
    });
  });
});
