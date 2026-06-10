import { sha256Hex } from "@/lib/invoice/source-hash";
import { signPayload, verifyPayload } from "@/lib/demo/signed-token";

/**
 * Content-binding token for the upload lane. /api/demo/translate signs it over
 * the exact { invoice, sourceXml } it returned; /api/demo/pdf refuses to render
 * upload content without a matching token, so the PDF route can never render
 * content that did not pass the translate pipeline. TTL is longer than the
 * 10-minute download token so a visitor can browse before downloading.
 */
const TTL_MS = 60 * 60 * 1000;

export interface UploadTokenPayload {
  hash: string;
  lang: string;
}

/** sha256 over the exact invoice JSON the client holds plus the source XML. */
export async function demoContentHash(invoice: unknown, sourceXml: string): Promise<string> {
  return sha256Hex(Buffer.from(`${JSON.stringify(invoice)}\0${sourceXml}`, "utf8"));
}

export function signUploadToken(payload: UploadTokenPayload, now: number = Date.now()): string {
  return signPayload(payload, TTL_MS, now);
}

export function verifyUploadToken(
  token: string,
  now: number = Date.now()
): { valid: boolean; payload?: UploadTokenPayload } {
  const result = verifyPayload(token, now);
  if (!result.valid || !result.payload) return { valid: false };
  const { hash, lang } = result.payload;
  if (typeof hash !== "string" || !hash || typeof lang !== "string") return { valid: false };
  return { valid: true, payload: { hash, lang } };
}
