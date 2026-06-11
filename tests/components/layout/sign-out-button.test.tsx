// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const resetAnalyticsIdentityMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  resetAnalyticsIdentity: resetAnalyticsIdentityMock
}));

import { SignOutButton } from "@/components/layout/sign-out-button";

describe("SignOutButton", () => {
  it("resets the analytics identity on click", () => {
    render(<SignOutButton label="Wyloguj" />);
    fireEvent.click(screen.getByRole("button", { name: "Wyloguj" }));
    expect(resetAnalyticsIdentityMock).toHaveBeenCalledTimes(1);
  });
});
