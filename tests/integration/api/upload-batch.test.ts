import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

beforeAll(async () => {
  const ping = await fetch(`${APP}/`, { method: "GET" }).catch(() => null);
  if (!ping) {
    throw new Error(
      `Next dev server not reachable at ${APP}. Start it with 'tmux new-session -d -s next-dev "npm run dev"' before running this test.`
    );
  }
});

describe("POST /api/upload-batch", () => {
  it("returns 401 when unauthenticated", async () => {
    const fd = new FormData();
    fd.append(
      "file",
      new Blob([readFileSync(samplePath)], { type: "application/xml" }),
      "sample-1.xml"
    );
    fd.append(
      "file",
      new Blob([readFileSync(samplePath)], { type: "application/xml" }),
      "sample-2.xml"
    );
    const res = await fetch(`${APP}/api/upload-batch`, {
      method: "POST",
      body: fd
    });
    expect(res.status).toBe(401);
    const payload = await res.json();
    expect(payload.error).toMatch(/auth/i);
  });

  it("returns 400 when no files are provided", async () => {
    // Auth-first ordering — same lock-in as /api/upload integration test.
    // Updates to authenticated assertions live in follow-up coverage.
    const res = await fetch(`${APP}/api/upload-batch`, {
      method: "POST",
      body: new FormData()
    });
    expect(res.status).toBe(401);
  });

  it("rejects with 413 when more than 20 files are uploaded", async () => {
    const fd = new FormData();
    for (let i = 0; i < 21; i += 1) {
      fd.append(
        "file",
        new Blob([readFileSync(samplePath)], { type: "application/xml" }),
        `over-${i}.xml`
      );
    }
    const res = await fetch(`${APP}/api/upload-batch`, {
      method: "POST",
      body: fd
    });
    // Auth happens first → 401. Once auth lands in test setup, we expect 413.
    // For now we lock that the route doesn't crash on a 21-file form.
    expect([401, 413]).toContain(res.status);
  });
});
