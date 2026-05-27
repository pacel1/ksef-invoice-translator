import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakturowniaPost, fakturowniaGet } from "@/lib/billing/fakturownia/client";
import { FakturowniaApiError } from "@/lib/billing/fakturownia/types";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.FAKTUROWNIA_ACCOUNT = "mycompany";
  process.env.FAKTUROWNIA_API_TOKEN = "test-token";
  process.env.FAKTUROWNIA_ENV = "demo";
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

describe("fakturownia client", () => {
  it("POST hits the demo subdomain when FAKTUROWNIA_ENV=demo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), { status: 200 })
    );
    globalThis.fetch = fetchMock;

    await fakturowniaPost("/invoices.json", { foo: "bar" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://mycompany.demo.fakturownia.pl/invoices.json");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ foo: "bar", api_token: "test-token" });
  });

  it("POST hits the production subdomain when FAKTUROWNIA_ENV=production", async () => {
    process.env.FAKTUROWNIA_ENV = "production";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), { status: 200 })
    );
    globalThis.fetch = fetchMock;

    await fakturowniaPost("/invoices.json", { foo: "bar" });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://mycompany.fakturownia.pl/invoices.json"
    );
  });

  it("returns parsed JSON on 2xx", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 42, number: "1/2026" }), { status: 200 })
    );

    const result = await fakturowniaPost<{ id: number; number: string }>(
      "/invoices.json",
      {}
    );
    expect(result).toEqual({ id: 42, number: "1/2026" });
  });

  it("throws FakturowniaApiError on 4xx with parsed JSON body", async () => {
    // Response bodies are single-use streams, so we return a fresh one
    // per call to allow two assertions against the same path.
    globalThis.fetch = vi.fn().mockImplementation(
      () =>
        new Response(
          JSON.stringify({ message: "Invalid NIP", errors: { buyer_tax_no: ["bad"] } }),
          { status: 422 }
        )
    );

    await expect(fakturowniaPost("/invoices.json", {})).rejects.toBeInstanceOf(
      FakturowniaApiError
    );
    await expect(fakturowniaPost("/invoices.json", {})).rejects.toMatchObject({
      status: 422
    });
  });

  it("throws FakturowniaApiError on 5xx with raw text body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", { status: 500 })
    );

    await expect(fakturowniaPost("/invoices.json", {})).rejects.toMatchObject({
      status: 500,
      body: "Internal Server Error"
    });
  });

  it("throws when FAKTUROWNIA_API_TOKEN is missing", async () => {
    delete process.env.FAKTUROWNIA_API_TOKEN;
    await expect(fakturowniaPost("/invoices.json", {})).rejects.toThrow(
      /FAKTUROWNIA_API_TOKEN/
    );
  });

  it("throws when FAKTUROWNIA_ACCOUNT is missing", async () => {
    delete process.env.FAKTUROWNIA_ACCOUNT;
    await expect(fakturowniaPost("/invoices.json", {})).rejects.toThrow(
      /FAKTUROWNIA_ACCOUNT/
    );
  });

  it("GET assembles URL with query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), { status: 200 })
    );
    globalThis.fetch = fetchMock;

    await fakturowniaGet("/invoices/42.json");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://mycompany.demo.fakturownia.pl/invoices/42.json?api_token=test-token"
    );
  });

  it("respects a 10-second AbortController timeout", async () => {
    vi.useFakeTimers();
    let abortSignal: AbortSignal | undefined;
    // Mirror real fetch behaviour: listen for abort and reject with AbortError.
    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      abortSignal = init.signal;
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    const promise = fakturowniaPost("/invoices.json", {});
    // Advance past the 10s timeout.
    vi.advanceTimersByTime(10_001);
    await expect(promise).rejects.toThrow();
    expect(abortSignal?.aborted).toBe(true);

    vi.useRealTimers();
  });
});
