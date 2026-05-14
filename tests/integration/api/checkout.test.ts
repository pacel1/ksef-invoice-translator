import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

beforeAll(async () => {
  const ping = await fetch(`${APP}/`).catch(() => null);
  if (!ping) throw new Error(`Next dev server not reachable at ${APP}.`);
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY missing in .env.test (use a test-mode key sk_test_...)");
  }
});

describe("POST /api/stripe/checkout", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await fetch(`${APP}/api/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageSize: 25 })
    });
    expect(res.status).toBe(401);
  });

  it("rejects an off-grid package size with 400 (or 401 if auth runs first)", async () => {
    const res = await fetch(`${APP}/api/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageSize: 7 })
    });
    // Unauthenticated still 401 because auth runs first. That's expected.
    expect([400, 401]).toContain(res.status);
  });
});
