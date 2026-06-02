import { buildAuthHeader } from "./auth";
import { IfirmaApiError, type IfirmaResponseEnvelope } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;
const KEY_NAME = "faktura";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} not configured`);
  return value;
}

function baseUrl(): string {
  return process.env.IFIRMA_BASE_URL ?? "https://www.ifirma.pl/iapi";
}

function stripQuery(url: string): string {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const username = requireEnv("IFIRMA_USERNAME");
  const keyHex = requireEnv("IFIRMA_INVOICE_KEY");
  const fullUrl = `${baseUrl()}${path}`;
  const bodyString = method === "POST" ? JSON.stringify(body ?? {}) : "";

  const authHeader = buildAuthHeader({
    url: stripQuery(fullUrl),
    username,
    keyName: KEY_NAME,
    keyHex,
    body: bodyString
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method,
      headers: {
        Accept: "application/json",
        ...(method === "POST"
          ? { "Content-type": "application/json; charset=UTF-8" }
          : {}),
        Authentication: authHeader
      },
      body: method === "POST" ? bodyString : undefined,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new IfirmaApiError(
      response.status,
      null,
      text,
      `iFirma ${method} ${path} failed (HTTP ${response.status})`
    );
  }

  const json = (await response.json()) as T & Partial<IfirmaResponseEnvelope>;
  // iFirma wraps results in { response: { Kod, ... } }. Kod !== 0 is an error
  // even on HTTP 200.
  const kod = json.response?.Kod;
  if (typeof kod === "number" && kod !== 0) {
    throw new IfirmaApiError(
      response.status,
      kod,
      json,
      `iFirma ${method} ${path} returned Kod ${kod}: ${json.response?.Informacja ?? ""}`
    );
  }

  return json;
}

export function ifirmaPost<T>(path: string, body: unknown): Promise<T> {
  return call<T>("POST", path, body);
}

export function ifirmaGet<T>(path: string): Promise<T> {
  return call<T>("GET", path);
}

/** Binary GET (PDF). Returns the raw bytes; does not parse JSON. */
export async function ifirmaGetBinary(path: string): Promise<ArrayBuffer> {
  const username = requireEnv("IFIRMA_USERNAME");
  const keyHex = requireEnv("IFIRMA_INVOICE_KEY");
  const fullUrl = `${baseUrl()}${path}`;
  const authHeader = buildAuthHeader({
    url: stripQuery(fullUrl),
    username,
    keyName: KEY_NAME,
    keyHex,
    body: ""
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method: "GET",
      headers: { Accept: "application/pdf", Authentication: authHeader },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new IfirmaApiError(
      response.status,
      null,
      null,
      `iFirma GET ${path} (binary) failed (HTTP ${response.status})`
    );
  }
  return response.arrayBuffer();
}
