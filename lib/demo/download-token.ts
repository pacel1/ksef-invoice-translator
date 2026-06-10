import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 10 * 60 * 1000;

export interface DownloadTokenPayload {
  lang: string;
  source: "sample" | "upload";
}

interface SignedPayload extends DownloadTokenPayload {
  exp: number;
}

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

/** Returns `base64url(payload).base64url(hmac)`. `now` is injectable for tests. */
export function signDownloadToken(payload: DownloadTokenPayload, now: number = Date.now()): string {
  const full: SignedPayload = { ...payload, exp: now + TTL_MS };
  const body = b64url(JSON.stringify(full));
  return `${body}.${hmac(body)}`;
}

export function verifyDownloadToken(
  token: string,
  now: number = Date.now()
): { valid: boolean; payload?: DownloadTokenPayload } {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false };
  const [body, sig] = parts;
  const expected = hmac(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false };
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedPayload;
    if (typeof parsed.exp !== "number" || parsed.exp < now) return { valid: false };
    return { valid: true, payload: { lang: parsed.lang, source: parsed.source } };
  } catch {
    return { valid: false };
  }
}
