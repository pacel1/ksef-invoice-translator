import { signPayload, verifyPayload } from "@/lib/demo/signed-token";

const TTL_MS = 10 * 60 * 1000;

// No nonce field: single-use tracking would need server-side state, which the
// stateless demo design forbids. HMAC integrity, the 10-minute TTL, and the
// per-IP pdf render cap bound replay instead.
export interface DownloadTokenPayload {
  lang: string;
  source: "sample" | "upload";
}

/** Returns `base64url(payload).base64url(hmac)`. `now` is injectable for tests. */
export function signDownloadToken(payload: DownloadTokenPayload, now: number = Date.now()): string {
  return signPayload(payload, TTL_MS, now);
}

export function verifyDownloadToken(
  token: string,
  now: number = Date.now()
): { valid: boolean; payload?: DownloadTokenPayload } {
  const result = verifyPayload(token, now);
  if (!result.valid || !result.payload) return { valid: false };
  const { lang, source } = result.payload;
  if (typeof lang !== "string" || (source !== "sample" && source !== "upload")) return { valid: false };
  return { valid: true, payload: { lang, source } };
}
