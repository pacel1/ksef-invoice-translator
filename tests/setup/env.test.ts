import { describe, it, expect } from "vitest";

describe("test env", () => {
  it("has supabase env vars loaded", () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toMatch(/^http/);
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy();
  });
});
