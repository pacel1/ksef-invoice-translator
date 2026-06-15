import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { SignupConversion } from "@/components/analytics/signup-conversion";

function dataLayer(): Array<Record<string, unknown>> {
  return (window as { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? [];
}

afterEach(() => {
  cleanup();
  delete (window as { dataLayer?: unknown }).dataLayer;
  window.history.replaceState(null, "", "/");
});

describe("<SignupConversion>", () => {
  it("pushes a sign_up event when the signup flag is present", () => {
    window.history.replaceState(null, "", "/dashboard?signup=1");
    render(<SignupConversion />);
    expect(dataLayer()).toContainEqual({ event: "sign_up" });
  });

  it("strips the signup flag from the URL so a refresh does not re-fire", () => {
    window.history.replaceState(null, "", "/dashboard?signup=1&foo=bar");
    render(<SignupConversion />);
    expect(window.location.search).not.toContain("signup");
    expect(window.location.search).toContain("foo=bar");
    expect(window.location.pathname).toBe("/dashboard");
  });

  it("pushes nothing without the signup flag", () => {
    window.history.replaceState(null, "", "/dashboard");
    render(<SignupConversion />);
    expect(dataLayer().filter((e) => e.event === "sign_up")).toEqual([]);
  });

  it("renders no DOM", () => {
    window.history.replaceState(null, "", "/dashboard?signup=1");
    const { container } = render(<SignupConversion />);
    expect(container.firstChild).toBeNull();
  });
});
