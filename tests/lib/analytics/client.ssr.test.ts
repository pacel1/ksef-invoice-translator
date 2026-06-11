// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
  captureException: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  set_config: vi.fn(),
  get_distinct_id: vi.fn(),
  get_session_id: vi.fn()
}));

vi.mock("posthog-js", () => ({ default: posthogMock }));

import {
  captureClient,
  captureClientError,
  getAnalyticsSessionId,
  identifyAuthenticatedUser,
  resetAnalyticsIdentity
} from "@/lib/analytics/client";

describe("SSR safety (no window)", () => {
  it("every wrapper no-ops without touching posthog", () => {
    captureClient("login_submitted", { method: "email_otp" });
    captureClientError(new Error("boom"));
    identifyAuthenticatedUser("user-1", { email: "a@b.pl" });
    resetAnalyticsIdentity();
    expect(getAnalyticsSessionId()).toBeUndefined();

    expect(posthogMock.capture).not.toHaveBeenCalled();
    expect(posthogMock.captureException).not.toHaveBeenCalled();
    expect(posthogMock.identify).not.toHaveBeenCalled();
    expect(posthogMock.reset).not.toHaveBeenCalled();
    expect(posthogMock.set_config).not.toHaveBeenCalled();
  });
});
