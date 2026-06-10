import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const value = process.env.DEMO_TOKEN_SECRET;
  if (!value) throw new Error("DEMO_TOKEN_SECRET is not configured.");
  return value;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

/** Returns `base64url(payload+exp).base64url(hmac)`. `now` is injectable for tests. */
export function signPayload(payload: object, ttlMs: number, now: number = Date.now()): string {
  const body = b64url(JSON.stringify({ ...payload, exp: now + ttlMs }));
  return `${body}.${hmac(body)}`;
}

/** Verifies the signature and expiry; the caller validates the payload shape. */
export function verifyPayload(
  token: string,
  now: number = Date.now()
): { valid: boolean; payload?: Record<string, unknown> } {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false };
  const [body, sig] = parts;
  const a = Buffer.from(sig);
  const b = Buffer.from(hmac(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false };
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof parsed.exp !== "number" || parsed.exp < now) return { valid: false };
    return { valid: true, payload: parsed };
  } catch {
    return { valid: false };
  }
}
