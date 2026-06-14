// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const captureClientMock = vi.hoisted(() => vi.fn());
const resetAnalyticsIdentityMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  captureClient: captureClientMock,
  captureClientError: vi.fn(),
  resetAnalyticsIdentity: resetAnalyticsIdentityMock
}));

import { SignOutButton } from "@/components/layout/sign-out-button";

describe("SignOutButton", () => {
  beforeEach(() => {
    captureClientMock.mockClear();
    resetAnalyticsIdentityMock.mockClear();
  });

  it("resets the analytics identity on click", () => {
    render(<SignOutButton label="Wyloguj" />);
    fireEvent.click(screen.getByRole("button", { name: "Wyloguj" }));
    expect(resetAnalyticsIdentityMock).toHaveBeenCalledTimes(1);
  });

  it("captures signed_out before resetting identity", () => {
    render(<SignOutButton label="Wyloguj" />);
    fireEvent.click(screen.getByRole("button", { name: "Wyloguj" }));
    expect(captureClientMock).toHaveBeenCalledWith("signed_out", {});
    // ordering: signed_out must be captured BEFORE the identity reset, because
    // reset drops the distinct id and the event must carry identity.
    const captureOrder = captureClientMock.mock.invocationCallOrder[0];
    const resetOrder = resetAnalyticsIdentityMock.mock.invocationCallOrder[0];
    expect(captureOrder).toBeLessThan(resetOrder);
  });
});
