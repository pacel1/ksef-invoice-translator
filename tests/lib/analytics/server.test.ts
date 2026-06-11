import { afterEach, describe, expect, it, vi } from "vitest";

// vi.hoisted so the hoisted vi.mock factories can reference these safely.
const { captureMock, flushMock, afterCallbacks, afterBehavior } = vi.hoisted(
  () => ({
    captureMock: vi.fn(),
    flushMock: vi.fn().mockResolvedValue(undefined),
    afterCallbacks: [] as Array<() => Promise<void> | void>,
    afterBehavior: { throwOutsideRequestScope: false }
  })
);

vi.mock("next/server", () => ({
  after: (cb: () => Promise<void> | void) => {
    if (afterBehavior.throwOutsideRequestScope) {
      throw new Error("`after` was called outside a request scope.");
    }
    afterCallbacks.push(cb);
  }
}));

vi.mock("posthog-node", () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: captureMock,
    flush: flushMock
  }))
}));

async function importFreshModule() {
  vi.resetModules();
  return import("@/lib/analytics/server");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  afterBehavior.throwOutsideRequestScope = false;
});

describe("captureServer", () => {
  it("defers capture + flush to after() and stitches $session_id", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    const { captureServer } = await importFreshModule();

    captureServer({
      distinctId: "user-1",
      event: "payment_completed",
      properties: {
        package_size: 10,
        total_amount_cents: 5990,
        currency: "pln",
        stripe_session_id: "cs_1"
      },
      sessionId: "sess-1"
    });

    expect(captureMock).not.toHaveBeenCalled(); // deferred, not inline
    for (const cb of afterCallbacks) await cb();

    expect(captureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "payment_completed",
      properties: {
        package_size: 10,
        total_amount_cents: 5990,
        currency: "pln",
        stripe_session_id: "cs_1",
        $session_id: "sess-1"
      }
    });
    expect(flushMock).toHaveBeenCalled();
  });

  it("omits $session_id when no session is provided", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    const { captureServer } = await importFreshModule();

    captureServer({
      distinctId: "user-1",
      event: "payment_failed",
      properties: { stripe_session_id: "cs_1", purchase_id: "p_1" }
    });
    for (const cb of afterCallbacks) await cb();

    const props = captureMock.mock.calls[0][0].properties;
    expect(props).not.toHaveProperty("$session_id");
  });

  it("skips capture without throwing when env vars are missing", async () => {
    // Explicitly blank the vars: the shell or .env.test may carry real values.
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { captureServer } = await importFreshModule();

    expect(() =>
      captureServer({
        distinctId: "user-1",
        event: "payment_failed",
        properties: { stripe_session_id: "cs_1", purchase_id: "p_1" }
      })
    ).not.toThrow();
    expect(afterCallbacks).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("logs and swallows when after() is unavailable (outside request scope)", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    afterBehavior.throwOutsideRequestScope = true;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { captureServer } = await importFreshModule();

    expect(() =>
      captureServer({
        distinctId: "user-1",
        event: "payment_failed",
        properties: { stripe_session_id: "cs_1", purchase_id: "p_1" }
      })
    ).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
