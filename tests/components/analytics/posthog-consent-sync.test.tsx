// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

const posthogMock = vi.hoisted(() => ({
  set_config: vi.fn(),
  reset: vi.fn()
}));
vi.mock("posthog-js", () => ({ default: posthogMock }));

import { PostHogConsentSync } from "@/components/analytics/posthog-consent-sync";
import { createConsentState } from "@/lib/consent/storage";
import type { ConsentState } from "@/lib/consent/types";

const DECIDED_AT = new Date("2026-06-11T12:00:00.000Z");

function stateFor(prefs: { analytics: boolean; marketing: boolean }): ConsentState {
  return createConsentState(prefs, DECIDED_AT);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("<PostHogConsentSync>", () => {
  it("does nothing while the decision is undecided", () => {
    const { container } = render(<PostHogConsentSync consent={null} />);
    expect(container.firstChild).toBeNull();
    expect(posthogMock.set_config).not.toHaveBeenCalled();
    expect(posthogMock.reset).not.toHaveBeenCalled();
  });

  it("upgrades persistence without resetting when analytics is granted", () => {
    render(<PostHogConsentSync consent={stateFor({ analytics: true, marketing: false })} />);
    expect(posthogMock.set_config).toHaveBeenCalledWith({ persistence: "localStorage+cookie" });
    expect(posthogMock.reset).not.toHaveBeenCalled();
  });

  it("resets before dropping to memory persistence when analytics is declined", () => {
    render(<PostHogConsentSync consent={stateFor({ analytics: false, marketing: true })} />);
    expect(posthogMock.reset).toHaveBeenCalledTimes(1);
    expect(posthogMock.set_config).toHaveBeenCalledWith({ persistence: "memory" });
    // reset() must clear ph_* residue while the old persistence is still active,
    // i.e. strictly before set_config switches to memory.
    expect(posthogMock.reset.mock.invocationCallOrder[0]).toBeLessThan(
      posthogMock.set_config.mock.invocationCallOrder[0]
    );
  });
});
