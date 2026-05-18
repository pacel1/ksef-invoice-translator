import { describe, it, expect, beforeAll } from "vitest";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

beforeAll(async () => {
  const ping = await fetch(`${APP}/`).catch(() => null);
  if (!ping) {
    throw new Error(`Next dev server not reachable at ${APP}.`);
  }
});

describe("POST /api/me/export", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await fetch(`${APP}/api/me/export`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("rejects GET (POST only)", async () => {
    const res = await fetch(`${APP}/api/me/export`);
    expect([404, 405]).toContain(res.status);
  });
});
