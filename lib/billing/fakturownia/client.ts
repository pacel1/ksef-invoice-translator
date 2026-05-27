import { FakturowniaApiError, type FakturowniaErrorBody } from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} not configured`);
  }
  return value;
}

function baseUrl(): string {
  const account = requireEnv("FAKTUROWNIA_ACCOUNT");
  const env = process.env.FAKTUROWNIA_ENV ?? "demo";
  // demo: <account>.demo.fakturownia.pl ; production: <account>.fakturownia.pl
  // Per Fakturownia docs (github.com/fakturownia/API): the only difference is
  // the subdomain segment.
  const subdomain = env === "production" ? account : `${account}.demo`;
  return `https://${subdomain}.fakturownia.pl`;
}

/** Internal: perform the fetch with timeout + error envelope. */
async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const apiToken = requireEnv("FAKTUROWNIA_API_TOKEN");

  // For GET, Fakturownia accepts api_token as a query param.
  // For POST, the convention is to nest it in the JSON body. Both forms
  // are documented; we use whichever the operation expects.
  const url =
    method === "GET"
      ? `${baseUrl()}${path}${path.includes("?") ? "&" : "?"}api_token=${encodeURIComponent(apiToken)}`
      : `${baseUrl()}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers:
        method === "POST"
          ? { "Content-Type": "application/json", Accept: "application/json" }
          : { Accept: "application/json" },
      body:
        method === "POST"
          ? JSON.stringify({ ...(body as object), api_token: apiToken })
          : undefined,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.ok) {
    return (await response.json()) as T;
  }

  // Parse body for better error messages. Try JSON first, fall back to text.
  const text = await response.text();
  let parsed: FakturowniaErrorBody | string;
  try {
    parsed = JSON.parse(text) as FakturowniaErrorBody;
  } catch {
    parsed = text;
  }

  const message =
    typeof parsed === "string"
      ? `Fakturownia ${method} ${path} failed (${response.status})`
      : `Fakturownia ${method} ${path} failed (${response.status}): ${
          parsed.message ?? JSON.stringify(parsed.errors ?? parsed)
        }`;

  throw new FakturowniaApiError(response.status, parsed, message);
}

export function fakturowniaPost<T>(path: string, body: unknown): Promise<T> {
  return call<T>("POST", path, body);
}

export function fakturowniaGet<T>(path: string): Promise<T> {
  return call<T>("GET", path);
}
