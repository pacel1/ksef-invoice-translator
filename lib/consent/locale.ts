import type { ConsentLocale } from "./types";

/** Mirrors the routing convention: `/en` and `/en/...` are English, everything else Polish. */
export function localeFromPathname(pathname: string): ConsentLocale {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  return "pl";
}
