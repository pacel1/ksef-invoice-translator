const DEFAULT_REDIRECT = "/app";

/**
 * Returns `raw` only when it is a safe same-origin *relative* path, otherwise the
 * fallback. This prevents open redirects from a caller-supplied `redirect_to`:
 * after a user authenticates on our domain, bouncing them to an attacker host is
 * a highly convincing phishing primitive.
 *
 * A value is accepted only if it starts with a single "/", contains no control
 * characters or whitespace (which browsers strip/normalise, e.g. turning
 * "/\t/evil.com" into a protocol-relative URL), and is not "//host" or "/\host"
 * (both of which WHATWG URL parsing resolves to an external host for http(s)).
 */
export function safeRedirectPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT
): string {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  // Reject C0 control chars, space and DEL (covers tab/newline/CR that browsers
  // strip when resolving a URL, which could unhide a protocol-relative target).
  if (/[\x00-\x20\x7f]/.test(raw)) return fallback;
  if (!raw.startsWith("/")) return fallback;
  // "//host" and "/\host" both resolve to an external origin under WHATWG URL.
  if (raw[1] === "/" || raw[1] === "\\") return fallback;
  return raw;
}
