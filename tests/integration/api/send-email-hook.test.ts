import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { Webhook } from "standardwebhooks";
import { createClient } from "@supabase/supabase-js";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const HOOK_SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET!;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const ping = await fetch(`${APP}/`).catch(() => null);
  if (!ping) throw new Error(`Next dev server not reachable at ${APP}.`);
  if (!HOOK_SECRET) throw new Error("SUPABASE_AUTH_HOOK_SECRET missing in .env.test");
});

afterEach(async () => {
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()!;
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

function normalizeSecret(s: string): string {
  // `standardwebhooks` only strips `whsec_`, not the outer `v1,` wrapper Supabase uses.
  return s.startsWith("v1,") ? s.slice(3) : s;
}

function sign(payload: string): Record<string, string> {
  const wh = new Webhook(normalizeSecret(HOOK_SECRET));
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const timestamp = new Date();
  const signature = wh.sign(id, timestamp, payload);
  return {
    "webhook-id": id,
    "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "webhook-signature": signature
  };
}

describe("POST /api/auth/send-email-hook", () => {
  it("returns 401 with no signature headers", async () => {
    const res = await fetch(`${APP}/api/auth/send-email-hook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: { email: "x@example.test" }, email_data: {} })
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 with a bad signature", async () => {
    const payload = JSON.stringify({ user: { email: "x@example.test" }, email_data: {} });
    const res = await fetch(`${APP}/api/auth/send-email-hook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "webhook-id": "msg_x",
        "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
        "webhook-signature": "v1,deadbeef"
      },
      body: payload
    });
    expect(res.status).toBe(401);
  });

  // We don't assert real email delivery here — that would require hitting Resend's API
  // with a verified sender. The unit tests in lib/send-email-hook cover the rendering
  // and Resend invocation with a mock. This integration test only confirms wiring.
  it("accepts a valid signature and returns 2xx OR 502 (Resend may reject test domains)", async () => {
    const email = `route-${Date.now()}@example.test`;
    const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
    const userId = data.user!.id;
    createdUserIds.push(userId);

    const payload = JSON.stringify({
      user: { id: userId, email },
      email_data: {
        token: "x",
        token_hash: "hashval",
        redirect_to: "/app",
        email_action_type: "magiclink",
        site_url: APP
      }
    });
    const res = await fetch(`${APP}/api/auth/send-email-hook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sign(payload) },
      body: payload
    });
    // 200: Resend accepted (real send happened). 502: Resend rejected the address (e.g. unverified domain).
    // Both prove signature verification + locale lookup + Resend call succeeded.
    expect([200, 502]).toContain(res.status);
  });
});
