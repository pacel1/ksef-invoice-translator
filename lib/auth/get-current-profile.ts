import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UiLanguage } from "@/lib/workspace/copy";

export interface CurrentProfile {
  locale: string | null;
  uiLanguage: UiLanguage;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

/**
 * Server-side helper that fetches the user's profile and derives the
 * resolved UI language plus reviewer name fields.
 *
 * Wrapped in React `cache()` so the protected layout's locale lookup
 * and the page-level reviewer-name check share a single profiles
 * SELECT per request. PL is the default when locale is anything other
 * than "en".
 */
export const getCurrentProfile = cache(async (userId: string): Promise<CurrentProfile> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("locale, first_name, last_name, display_name")
    .eq("id", userId)
    .single();
  const locale = data?.locale ?? null;
  return {
    locale,
    uiLanguage: locale === "en" ? "en" : "pl",
    firstName: data?.first_name ?? null,
    lastName: data?.last_name ?? null,
    displayName: data?.display_name ?? null
  };
});

/**
 * Returns the best display string for the "reviewed/translated by" line
 * on PDFs and similar surfaces. Prefers `first last` when both halves
 * are present, falls back to display_name, then email, then null.
 */
export function reviewerNameFromProfile(
  profile: Pick<CurrentProfile, "firstName" | "lastName" | "displayName">,
  emailFallback?: string | null
): string | null {
  const first = profile.firstName?.trim() ?? "";
  const last = profile.lastName?.trim() ?? "";
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  const display = profile.displayName?.trim();
  if (display) return display;
  return emailFallback ?? null;
}
