import { describe, it, expect, vi, afterEach } from "vitest";
import { Webhook } from "standardwebhooks";
import { createClient } from "@supabase/supabase-js";
import { processAuthEmailHook, AuthHookError } from "@/lib/auth/send-email-hook";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const HOOK_SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET!;

const createdUserIds: string[] = [];

async function newUserWithLocale(label: string, locale: "pl" | "en") {
  const email = `hook-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  const id = data.user!.id;
  createdUserIds.push(id);
  await admin.from("profiles").update({ locale }).eq("id", id);
  return { userId: id, email };
}

function normalizeSecret(secret: string): string {
  return secret.startsWith("v1,") ? secret.slice(3) : secret;
}

function sign(payload: string): { headers: Record<string, string> } {
  const wh = new Webhook(normalizeSecret(HOOK_SECRET));
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const timestamp = new Date();
  const signature = wh.sign(id, timestamp, payload);
  return {
    headers: {
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": signature
    }
  };
}

function buildPayload(email: string, actionType = "magiclink") {
  return JSON.stringify({
    user: { email, id: "00000000-0000-0000-0000-000000000001" },
    email_data: {
      token: "abc123",
      token_hash: "tokenhash123",
      redirect_to: "/app",
      email_action_type: actionType,
      site_url: "http://localhost:3000",
      token_new: "",
      token_hash_new: ""
    }
  });
}

afterEach(async () => {
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()!;
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe("processAuthEmailHook", () => {
  it("rejects payloads with no signature headers", async () => {
    const resendSend = vi.fn();
    await expect(
      processAuthEmailHook({
        rawBody: buildPayload("test@example.com"),
        headers: {},
        supabase: admin,
        resendSend,
        hookSecret: HOOK_SECRET,
        appUrl: "http://localhost:3000"
      })
    ).rejects.toBeInstanceOf(AuthHookError);
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("rejects payloads with bad signatures", async () => {
    const resendSend = vi.fn();
    const payload = buildPayload("test@example.com");
    await expect(
      processAuthEmailHook({
        rawBody: payload,
        headers: {
          "webhook-id": "x",
          "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
          "webhook-signature": "v1,deadbeef"
        },
        supabase: admin,
        resendSend,
        hookSecret: HOOK_SECRET,
        appUrl: "http://localhost:3000"
      })
    ).rejects.toBeInstanceOf(AuthHookError);
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("renders the PL template for a PL-locale user and sends via Resend", async () => {
    const { email } = await newUserWithLocale("pl-user", "pl");
    const payload = buildPayload(email);
    const { headers } = sign(payload);
    const resendSend = vi.fn().mockResolvedValue({ data: { id: "re_xyz" } });

    const result = await processAuthEmailHook({
      rawBody: payload,
      headers,
      supabase: admin,
      resendSend,
      hookSecret: HOOK_SECRET,
      appUrl: "https://ksef-invoice-translator.vercel.app"
    });

    expect(result.providerId).toBe("re_xyz");
    expect(resendSend).toHaveBeenCalledTimes(1);
    const call = resendSend.mock.calls[0][0];
    expect(call.to).toBe(email);
    expect(call.subject).toMatch(/zaloguj/i);
    expect(call.html).toContain("Zaloguj się jednym kliknięciem");
    expect(call.html).toContain(
      "https://ksef-invoice-translator.vercel.app/auth/callback?token_hash=tokenhash123"
    );
  });

  it("renders the EN template for an EN-locale user", async () => {
    const { email } = await newUserWithLocale("en-user", "en");
    const payload = buildPayload(email);
    const { headers } = sign(payload);
    const resendSend = vi.fn().mockResolvedValue({ data: { id: "re_abc" } });

    await processAuthEmailHook({
      rawBody: payload,
      headers,
      supabase: admin,
      resendSend,
      hookSecret: HOOK_SECRET,
      appUrl: "https://ksef-invoice-translator.vercel.app"
    });

    const call = resendSend.mock.calls[0][0];
    expect(call.subject).toMatch(/sign in/i);
    expect(call.html).toContain("One-click sign-in");
  });

  it("falls back to EN when the user has no profile row", async () => {
    // We don't create a profile — just call with an arbitrary email.
    const payload = buildPayload("ghost@example.test");
    const { headers } = sign(payload);
    const resendSend = vi.fn().mockResolvedValue({ data: { id: "re_ghost" } });

    await processAuthEmailHook({
      rawBody: payload,
      headers,
      supabase: admin,
      resendSend,
      hookSecret: HOOK_SECRET,
      appUrl: "http://localhost:3000"
    });

    const call = resendSend.mock.calls[0][0];
    expect(call.subject).toMatch(/sign in/i);
  });
});
