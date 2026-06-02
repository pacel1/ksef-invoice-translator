import crypto from "node:crypto";

export interface BuildAuthHeaderParams {
  /** Request URL WITHOUT query string. */
  url: string;
  username: string;
  /** iFirma key name for the service, e.g. "faktura". */
  keyName: string;
  /** Hex-encoded API key. */
  keyHex: string;
  /** JSON request body for POST; "" for GET. */
  body: string;
}

/**
 * Build the iFirma `Authentication` header. The signature is
 * HMAC-SHA1(hexDecode(key), url + username + keyName + body), hex-encoded.
 * For GET requests pass body="" so the message omits it.
 */
export function buildAuthHeader(params: BuildAuthHeaderParams): string {
  const message = params.url + params.username + params.keyName + params.body;
  const hmac = crypto
    .createHmac("sha1", Buffer.from(params.keyHex, "hex"))
    .update(message, "utf8")
    .digest("hex");
  return `IAPIS user=${params.username}, hmac-sha1=${hmac}`;
}
