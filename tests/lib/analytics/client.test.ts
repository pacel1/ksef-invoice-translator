// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above const declarations; vi.hoisted avoids the TDZ error.
const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
  captureException: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  set_config: vi.fn(),
  get_distinct_id: vi.fn(() => "anon-123"),
  get_session_id: vi.fn(() => "sess-1")
}));

vi.mock("posthog-js", () => ({ default: posthogMock }));

import {
  captureClient,
  captureClientError,
  getAnalyticsSessionId,
  identifyAuthenticatedUser,
  resetAnalyticsIdentity
} from "@/lib/analytics/client";
import { CONSENT_STORAGE_KEY } from "@/lib/analytics/consent";

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  posthogMock.get_distinct_id.mockReturnValue("anon-123");
});

describe("captureClient", () => {
  it("forwards typed events to posthog", () => {
    captureClient("login_submitted", { method: "email_otp" });
    expect(posthogMock.capture).toHaveBeenCalledWith("login_submitted", {
      method: "email_otp"
    });
  });
});

describe("captureClientError", () => {
  it("forwards errors to posthog", () => {
    const err = new Error("boom");
    captureClientError(err);
    expect(posthogMock.captureException).toHaveBeenCalledWith(err);
  });
});

describe("identifyAuthenticatedUser", () => {
  it("upgrades persistence and identifies by user id", () => {
    identifyAuthenticatedUser("user-1", { email: "a@b.pl", locale: "pl" });
    expect(posthogMock.set_config).toHaveBeenCalledWith({
      persistence: "localStorage+cookie"
    });
    expect(posthogMock.identify).toHaveBeenCalledWith("user-1", {
      email: "a@b.pl",
      locale: "pl"
    });
  });

  it("does nothing when the user is already identified", () => {
    posthogMock.get_distinct_id.mockReturnValue("user-1");
    identifyAuthenticatedUser("user-1", { email: "a@b.pl", locale: "pl" });
    expect(posthogMock.identify).not.toHaveBeenCalled();
    expect(posthogMock.set_config).not.toHaveBeenCalled();
  });
});

describe("resetAnalyticsIdentity", () => {
  it("resets and returns to memory persistence without accepted consent", () => {
    resetAnalyticsIdentity();
    expect(posthogMock.reset).toHaveBeenCalled();
    expect(posthogMock.set_config).toHaveBeenCalledWith({ persistence: "memory" });
  });

  it("keeps cookie persistence when consent was accepted", () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ value: "accepted", at: "2026-06-01T00:00:00.000Z" })
    );
    resetAnalyticsIdentity();
    expect(posthogMock.set_config).toHaveBeenCalledWith({
      persistence: "localStorage+cookie"
    });
  });
});

describe("getAnalyticsSessionId", () => {
  it("returns the posthog session id", () => {
    expect(getAnalyticsSessionId()).toBe("sess-1");
  });

  it("normalizes an empty session id to undefined", () => {
    posthogMock.get_session_id.mockReturnValueOnce("");
    expect(getAnalyticsSessionId()).toBeUndefined();
  });
});
