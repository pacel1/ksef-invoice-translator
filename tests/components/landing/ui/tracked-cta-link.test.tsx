// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const captureClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  captureClient: captureClientMock,
  captureClientError: vi.fn()
}));
vi.mock("next/link", () => ({
  default: ({ href, onClick, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : "#"} onClick={onClick} {...rest}>{children}</a>
  )
}));

import { TrackedCtaLink } from "@/components/landing/ui/tracked-cta-link";

describe("TrackedCtaLink", () => {
  beforeEach(() => captureClientMock.mockClear());

  it("fires landing_cta_clicked with cta_id + locale on click", () => {
    render(
      <TrackedCtaLink href="/login" ctaId="nav_login" locale="pl" className="x">
        Zacznij
      </TrackedCtaLink>
    );
    fireEvent.click(screen.getByRole("link", { name: "Zacznij" }));
    expect(captureClientMock).toHaveBeenCalledWith("landing_cta_clicked", {
      cta_id: "nav_login",
      locale: "pl"
    });
  });
});
