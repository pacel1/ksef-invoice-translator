import { describe, it, expect, beforeAll } from "vitest";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

beforeAll(async () => {
  const ping = await fetch(`${APP}/`).catch(() => null);
  if (!ping) {
    throw new Error(`Next dev server not reachable at ${APP}.`);
  }
});

describe("DELETE /api/me/account", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await fetch(`${APP}/api/me/account`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmEmail: "any@example.test" })
    });
    expect(res.status).toBe(401);
  });

  it("rejects POST (DELETE only)", async () => {
    const res = await fetch(`${APP}/api/me/account`, { method: "POST" });
    expect([404, 405]).toContain(res.status);
  });

  it("returns 400 or 401 when confirmEmail body is missing", async () => {
    const res = await fetch(`${APP}/api/me/account`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    expect([400, 401]).toContain(res.status);
  });
});
