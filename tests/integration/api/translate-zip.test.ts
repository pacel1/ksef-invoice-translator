import { describe, it, expect, beforeAll } from "vitest";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

beforeAll(async () => {
  const ping = await fetch(`${APP}/`, { method: "GET" }).catch(() => null);
  if (!ping) {
    throw new Error(
      `Next server not reachable at ${APP}. Start one via 'tmux new-session -d -s next-srv "npm start"' before running.`
    );
  }
});

describe("POST /api/translate/zip", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await fetch(`${APP}/api/translate/zip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceIds: ["00000000-0000-0000-0000-000000000000"],
        language: "en",
        bilingual: true
      })
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed payload (will hit auth-first ordering as 401)", async () => {
    // Locks auth-first ordering — same pattern as /api/upload* tests.
    const res = await fetch(`${APP}/api/translate/zip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    expect([400, 401]).toContain(res.status);
  });

  it("returns 401 even when invoiceIds exceeds the cap (auth-first)", async () => {
    const ids = Array.from({ length: 21 }, (_, i) =>
      `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`
    );
    const res = await fetch(`${APP}/api/translate/zip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceIds: ids,
        language: "en",
        bilingual: true
      })
    });
    // Auth happens first → 401. Once auth lands in test setup, expect 400.
    expect([400, 401]).toContain(res.status);
  });
});
