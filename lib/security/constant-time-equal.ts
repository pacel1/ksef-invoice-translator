import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison of two secret strings, resistant to timing
 * side-channels. Returns false for any non-string input. The early length
 * check is required because timingSafeEqual throws on unequal-length buffers;
 * a secret's length is not itself sensitive.
 */
export function constantTimeEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
