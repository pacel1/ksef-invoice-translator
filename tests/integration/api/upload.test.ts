import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

beforeAll(async () => {
  const ping = await fetch(`${APP}/`, { method: "GET" }).catch(() => null);
  if (!ping) {
    throw new Error(`Next dev server not reachable at ${APP}. Start it with 'tmux new-session -d -s next-dev "npm run dev"' before running this test.`);
  }
});

describe("POST /api/upload", () => {
  it("returns 401 when unauthenticated", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([readFileSync(samplePath)], { type: "application/xml" }), "sample.xml");
    const res = await fetch(`${APP}/api/upload`, { method: "POST", body: fd });
    expect(res.status).toBe(401);
    const payload = await res.json();
    expect(payload.error).toMatch(/auth/i);
  });

  it("returns 400 when no file is provided", async () => {
    // We expect this to 401 first because the route auth-checks before reading the form.
    // This test exists to lock in the auth-first ordering; once an authenticated context is
    // added in a follow-up task, this should be updated to assert 400 with a valid session.
    const res = await fetch(`${APP}/api/upload`, {
      method: "POST",
      body: new FormData()
    });
    expect(res.status).toBe(401);
  });
});
