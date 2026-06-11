// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const identifyAuthenticatedUserMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  identifyAuthenticatedUser: identifyAuthenticatedUserMock
}));

import { IdentifyUser } from "@/components/analytics/identify-user";

describe("IdentifyUser", () => {
  it("identifies the user on mount and renders nothing", () => {
    const { container } = render(
      <IdentifyUser userId="user-1" email="a@b.pl" locale="pl" />
    );
    expect(identifyAuthenticatedUserMock).toHaveBeenCalledWith("user-1", {
      email: "a@b.pl",
      locale: "pl"
    });
    expect(container).toBeEmptyDOMElement();
  });
});
