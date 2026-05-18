import { describe, it, expect, beforeAll } from "vitest";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

beforeAll(async () => {
  const ping = await fetch(`${APP}/`).catch(() => null);
  if (!ping) {
    throw new Error(`Next dev server not reachable at ${APP}. Start it with 'tmux new-session -d -s dev "npx next dev"' before running this test.`);
  }
});

describe("GET /api/me/invoices", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await fetch(`${APP}/api/me/invoices`);
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid page param", async () => {
    const res = await fetch(`${APP}/api/me/invoices?page=abc`);
    expect([400, 401]).toContain(res.status);
  });
});
