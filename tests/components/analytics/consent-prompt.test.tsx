// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const posthogMock = vi.hoisted(() => ({ set_config: vi.fn() }));
vi.mock("posthog-js", () => ({ default: posthogMock }));

// The factory closes over this binding but only dereferences it at render
// time, so a plain let is safe here.
let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { ConsentPrompt } from "@/components/analytics/consent-prompt";
import { CONSENT_STORAGE_KEY } from "@/lib/analytics/consent";

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  pathname = "/";
});

describe("ConsentPrompt", () => {
  it("appears for visitors with no stored choice (PL copy on PL routes)", async () => {
    render(<ConsentPrompt />);
    expect(await screen.findByRole("button", { name: "Zgadzam się" })).toBeInTheDocument();
  });

  it("uses English copy under /en", async () => {
    pathname = "/en";
    render(<ConsentPrompt />);
    expect(await screen.findByRole("button", { name: "Accept" })).toBeInTheDocument();
  });

  it("stays hidden when a choice is already stored", () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ value: "declined", at: new Date().toISOString() })
    );
    render(<ConsentPrompt />);
    expect(screen.queryByRole("button", { name: "Zgadzam się" })).toBeNull();
  });

  it("accept stores the choice, upgrades persistence, and hides", async () => {
    render(<ConsentPrompt />);
    fireEvent.click(await screen.findByRole("button", { name: "Zgadzam się" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Zgadzam się" })).toBeNull()
    );
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toContain("accepted");
    expect(posthogMock.set_config).toHaveBeenCalledWith({
      persistence: "localStorage+cookie"
    });
  });

  it("decline stores the choice and keeps memory persistence", async () => {
    render(<ConsentPrompt />);
    fireEvent.click(await screen.findByRole("button", { name: "Nie teraz" }));
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toContain("declined");
    expect(posthogMock.set_config).toHaveBeenCalledWith({ persistence: "memory" });
  });
});
