/**
 * Maps a demo API HTTP status code to a stable, PII-free analytics error_code.
 * Mirrors the STATUS_ERRORS map in components/landing/demo/upload-panel.tsx but
 * emits analytics codes (stable across locales), not copy keys.
 * `undefined` status means the fetch threw before a response (network error).
 */
const STATUS_CODES: Record<number, string> = {
  403: "turnstile",
  413: "too_large",
  415: "unsupported",
  422: "parse_failed",
  429: "rate_limited",
  502: "translate_failed",
  503: "circuit_breaker"
};

export function demoErrorCodeFromStatus(status: number | undefined): string {
  if (status === undefined) return "network";
  return STATUS_CODES[status] ?? "error";
}

/** True when a demo response status is a rate limit (HTTP 429). */
export function isRateLimited(status: number | undefined): boolean {
  return status === 429;
}
