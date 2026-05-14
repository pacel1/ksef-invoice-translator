import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UiLanguage } from "@/lib/workspace/copy";

export interface CurrentProfile {
  locale: string | null;
  uiLanguage: UiLanguage;
}

/**
 * Server-side helper that fetches the user's profile (currently just `locale`)
 * and derives the resolved UI language.
 *
 * Wrapped in React `cache()` so that the protected layout's locale lookup and
 * the /app page's `uiLanguage` lookup share a single profiles select per
 * request. PL is the default when locale is anything other than "en".
 */
export const getCurrentProfile = cache(async (userId: string): Promise<CurrentProfile> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", userId)
    .single();
  const locale = data?.locale ?? null;
  return {
    locale,
    uiLanguage: locale === "en" ? "en" : "pl"
  };
});
