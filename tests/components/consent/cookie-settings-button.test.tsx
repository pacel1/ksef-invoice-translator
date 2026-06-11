import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CookieSettingsButton } from "@/components/consent/cookie-settings-button";
import { OPEN_COOKIE_SETTINGS_EVENT } from "@/lib/consent/types";

afterEach(cleanup);

describe("<CookieSettingsButton>", () => {
  it("renders the locale label and dispatches the open event", () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, listener);
    render(<CookieSettingsButton locale="pl" />);
    fireEvent.click(screen.getByRole("button", { name: "Ustawienia cookies" }));
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, listener);
  });

  it("renders English label and forwards className", () => {
    render(<CookieSettingsButton locale="en" className="custom-class" />);
    const button = screen.getByRole("button", { name: "Cookie settings" });
    expect(button.className).toContain("custom-class");
  });
});
