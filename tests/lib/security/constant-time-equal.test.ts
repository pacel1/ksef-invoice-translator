import { describe, it, expect } from "vitest";
import { constantTimeEqual } from "@/lib/security/constant-time-equal";

describe("constantTimeEqual", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEqual("Bearer s3cret-token", "Bearer s3cret-token")).toBe(true);
  });

  it("returns false for different strings of equal length", () => {
    expect(constantTimeEqual("Bearer aaaaaa", "Bearer bbbbbb")).toBe(false);
  });

  it("returns false for strings of different length", () => {
    expect(constantTimeEqual("short", "a much longer secret")).toBe(false);
  });

  it.each([
    [null, "x"],
    ["x", null],
    [undefined, "x"],
    ["x", undefined],
    [null, null]
  ])("returns false when either side is nullish (%s, %s)", (a, b) => {
    expect(constantTimeEqual(a as string | null, b as string | null)).toBe(false);
  });
});
