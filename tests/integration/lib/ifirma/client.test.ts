import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ifirmaPost, ifirmaGet } from "@/lib/billing/ifirma/client";
import { IfirmaApiError } from "@/lib/billing/ifirma/types";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.IFIRMA_USERNAME = "testuser";
  process.env.IFIRMA_INVOICE_KEY = "0123456789abcdef0123456789abcdef";
  delete process.env.IFIRMA_BASE_URL;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

describe("ifirma client", () => {
  it("POSTs to the iapi base with an Authentication header and JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { Kod: 0, Identyfikator: "1" } }), { status: 200 })
    );
    globalThis.fetch = fetchMock;

    await ifirmaPost("/fakturakraj.json", { Zaplacono: 1 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.ifirma.pl/iapi/fakturakraj.json");
    expect(init.method).toBe("POST");
    expect(init.headers.Authentication).toMatch(/^IAPIS user=testuser, hmac-sha1=[0-9a-f]{40}$/);
    expect(init.headers["Content-type"]).toMatch(/application\/json/);
    expect(JSON.parse(init.body)).toEqual({ Zaplacono: 1 });
  });

  it("signs POST using the EXACT serialized body string it sends", async () => {
    // The HMAC must be computed over the same string passed as the body,
    // or iFirma rejects the signature.
    let sentBody = "";
    let sentAuth = "";
    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      sentBody = init.body;
      sentAuth = init.headers.Authentication;
      return Promise.resolve(
        new Response(JSON.stringify({ response: { Kod: 0 } }), { status: 200 })
      );
    });
    const crypto = await import("node:crypto");
    await ifirmaPost("/fakturakraj.json", { b: 2, a: 1 });
    const url = "https://www.ifirma.pl/iapi/fakturakraj.json";
    const expectedHmac = crypto
      .createHmac("sha1", Buffer.from("0123456789abcdef0123456789abcdef", "hex"))
      .update(url + "testuser" + "faktura" + sentBody, "utf8")
      .digest("hex");
    expect(sentAuth).toBe(`IAPIS user=testuser, hmac-sha1=${expectedHmac}`);
  });

  it("GET strips the query string from the signed URL but fetches the full URL", async () => {
    let fetchedUrl = "";
    let auth = "";
    globalThis.fetch = vi.fn().mockImplementation((url, init) => {
      fetchedUrl = url;
      auth = init.headers.Authentication;
      return Promise.resolve(
        new Response(JSON.stringify({ response: { Kod: 0, Wynik: [] } }), { status: 200 })
      );
    });
    const crypto = await import("node:crypto");
    await ifirmaGet("/faktury.json?dataOd=2026-01-01&dataDo=2026-12-31");

    expect(fetchedUrl).toBe(
      "https://www.ifirma.pl/iapi/faktury.json?dataOd=2026-01-01&dataDo=2026-12-31"
    );
    const signedUrl = "https://www.ifirma.pl/iapi/faktury.json"; // no query
    const expectedHmac = crypto
      .createHmac("sha1", Buffer.from("0123456789abcdef0123456789abcdef", "hex"))
      .update(signedUrl + "testuser" + "faktura", "utf8")
      .digest("hex");
    expect(auth).toBe(`IAPIS user=testuser, hmac-sha1=${expectedHmac}`);
  });

  it("honours IFIRMA_BASE_URL override", async () => {
    process.env.IFIRMA_BASE_URL = "https://example.test/iapi";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { Kod: 0 } }), { status: 200 })
    );
    globalThis.fetch = fetchMock;
    await ifirmaGet("/faktury.json");
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.test/iapi/faktury.json");
  });

  it("throws IfirmaApiError when response Kod !== 0", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ response: { Kod: 400, Informacja: "Błędny NIP" } }), { status: 200 })
      )
    );
    await expect(ifirmaPost("/fakturakraj.json", {})).rejects.toBeInstanceOf(IfirmaApiError);
    await expect(ifirmaPost("/fakturakraj.json", {})).rejects.toMatchObject({ kod: 400 });
  });

  it("throws IfirmaApiError on non-2xx HTTP", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response("Forbidden", { status: 403 }))
    );
    await expect(ifirmaGet("/faktury.json")).rejects.toMatchObject({ status: 403 });
  });

  it("throws when IFIRMA_USERNAME is missing", async () => {
    delete process.env.IFIRMA_USERNAME;
    await expect(ifirmaGet("/faktury.json")).rejects.toThrow(/IFIRMA_USERNAME/);
  });

  it("throws when IFIRMA_INVOICE_KEY is missing", async () => {
    delete process.env.IFIRMA_INVOICE_KEY;
    await expect(ifirmaGet("/faktury.json")).rejects.toThrow(/IFIRMA_INVOICE_KEY/);
  });
});
