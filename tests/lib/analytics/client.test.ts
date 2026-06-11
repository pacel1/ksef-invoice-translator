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
import { buildConsentCookie, createConsentState } from "@/lib/consent/storage";
import { CONSENT_COOKIE_NAME } from "@/lib/consent/types";

/** Writes the `name=value` segment a browser would expose via document.cookie. */
function setConsentCookie(analytics: boolean, marketing: boolean) {
  const state = createConsentState({ analytics, marketing }, new Date("2026-06-01T00:00:00.000Z"));
  document.cookie = buildConsentCookie(state, false).split(";")[0];
}

function clearConsentCookie() {
  document.cookie = `${CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0`;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  clearConsentCookie();
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
  it("identifies by user id without touching persistence", () => {
    identifyAuthenticatedUser("user-1", { email: "a@b.pl", locale: "pl" });
    expect(posthogMock.identify).toHaveBeenCalledWith("user-1", {
      email: "a@b.pl",
      locale: "pl"
    });
    expect(posthogMock.set_config).not.toHaveBeenCalled();
  });

  it("does nothing when the user is already identified", () => {
    posthogMock.get_distinct_id.mockReturnValue("user-1");
    identifyAuthenticatedUser("user-1", { email: "a@b.pl", locale: "pl" });
    expect(posthogMock.identify).not.toHaveBeenCalled();
    expect(posthogMock.set_config).not.toHaveBeenCalled();
  });
});

describe("resetAnalyticsIdentity", () => {
  it("resets and returns to memory persistence without analytics consent", () => {
    resetAnalyticsIdentity();
    expect(posthogMock.reset).toHaveBeenCalled();
    expect(posthogMock.set_config).toHaveBeenCalledWith({ persistence: "memory" });
  });

  it("keeps cookie persistence when the consent cookie granted analytics", () => {
    setConsentCookie(true, false);
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
