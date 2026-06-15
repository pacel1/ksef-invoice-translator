import { describe, it, expect } from "vitest";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    "/app",
    "/app/history",
    "/account?tab=billing",
    "/translate#section"
  ])("passes through same-origin relative path %s", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    ["absolute https url", "https://evil.com/phish"],
    ["absolute http url", "http://evil.com"],
    ["protocol-relative", "//evil.com"],
    ["backslash host", "/\\evil.com"],
    ["double backslash", "/\\/evil.com"],
    ["scheme without slash", "https:evil.com"],
    ["tab-split protocol-relative", "/\t/evil.com"],
    ["newline injection", "/app\n//evil.com"],
    ["empty string", ""],
    ["null", null],
    ["undefined", undefined],
    ["bare word", "evil.com"]
  ])("falls back to the default /translate for %s", (_label, value) => {
    expect(safeRedirectPath(value as string | null | undefined)).toBe("/translate");
  });

  it("honours a custom fallback", () => {
    expect(safeRedirectPath("//evil.com", "/login")).toBe("/login");
  });
});
