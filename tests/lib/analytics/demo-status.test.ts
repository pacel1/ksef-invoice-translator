import { describe, it, expect } from "vitest";
import { demoErrorCodeFromStatus, isRateLimited } from "@/lib/analytics/demo-status";

describe("demoErrorCodeFromStatus", () => {
  it("maps known HTTP statuses to stable codes", () => {
    expect(demoErrorCodeFromStatus(429)).toBe("rate_limited");
    expect(demoErrorCodeFromStatus(415)).toBe("unsupported");
    expect(demoErrorCodeFromStatus(413)).toBe("too_large");
    expect(demoErrorCodeFromStatus(422)).toBe("parse_failed");
    expect(demoErrorCodeFromStatus(503)).toBe("circuit_breaker");
    expect(demoErrorCodeFromStatus(403)).toBe("turnstile");
    expect(demoErrorCodeFromStatus(502)).toBe("translate_failed");
  });

  it("falls back to 'error' for unmapped statuses", () => {
    expect(demoErrorCodeFromStatus(400)).toBe("error");
    expect(demoErrorCodeFromStatus(500)).toBe("error");
  });

  it("returns 'network' when status is undefined (fetch threw)", () => {
    expect(demoErrorCodeFromStatus(undefined)).toBe("network");
  });
});

describe("isRateLimited", () => {
  it("is true only for HTTP 429", () => {
    expect(isRateLimited(429)).toBe(true);
    expect(isRateLimited(503)).toBe(false);
    expect(isRateLimited(undefined)).toBe(false);
  });
});
