import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildAuthHeader } from "@/lib/billing/ifirma/auth";

// A fixed hex key so the expected HMAC is reproducible.
const KEY_HEX = "0123456789abcdef0123456789abcdef";
const USER = "testuser";
const KEY_NAME = "faktura";

function expectedHmac(message: string): string {
  return crypto
    .createHmac("sha1", Buffer.from(KEY_HEX, "hex"))
    .update(message, "utf8")
    .digest("hex");
}

describe("buildAuthHeader", () => {
  it("formats the header as 'IAPIS user=<u>, hmac-sha1=<hex>'", () => {
    const url = "https://www.ifirma.pl/iapi/fakturakraj.json";
    const body = '{"Zaplacono":1}';
    const header = buildAuthHeader({
      url,
      username: USER,
      keyName: KEY_NAME,
      keyHex: KEY_HEX,
      body
    });
    const expected = expectedHmac(url + USER + KEY_NAME + body);
    expect(header).toBe(`IAPIS user=${USER}, hmac-sha1=${expected}`);
  });

  it("hex-decodes the key before signing (not used as a UTF-8 string)", () => {
    const url = "https://www.ifirma.pl/iapi/fakturakraj.json";
    const header = buildAuthHeader({
      url,
      username: USER,
      keyName: KEY_NAME,
      keyHex: KEY_HEX,
      body: ""
    });
    // If the key were used as a literal string the digest would differ.
    const wrongIfStringKey = crypto
      .createHmac("sha1", KEY_HEX) // raw string, NOT hex-decoded
      .update(url + USER + KEY_NAME, "utf8")
      .digest("hex");
    expect(header).not.toContain(wrongIfStringKey);
  });

  it("omits the body from the message for GET (empty body)", () => {
    const url = "https://www.ifirma.pl/iapi/fakturakraj/123.pdf";
    const header = buildAuthHeader({
      url,
      username: USER,
      keyName: KEY_NAME,
      keyHex: KEY_HEX,
      body: ""
    });
    const expected = expectedHmac(url + USER + KEY_NAME);
    expect(header).toBe(`IAPIS user=${USER}, hmac-sha1=${expected}`);
  });

  it("produces a different hash when the body changes", () => {
    const url = "https://www.ifirma.pl/iapi/fakturakraj.json";
    const a = buildAuthHeader({ url, username: USER, keyName: KEY_NAME, keyHex: KEY_HEX, body: '{"a":1}' });
    const b = buildAuthHeader({ url, username: USER, keyName: KEY_NAME, keyHex: KEY_HEX, body: '{"a":2}' });
    expect(a).not.toBe(b);
  });
});
