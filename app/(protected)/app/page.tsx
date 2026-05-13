import { TranslatorWorkspace } from "@/components/workspace/translator-workspace";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UiLanguage } from "@/lib/workspace/copy";

export default async function AppPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();

  const uiLanguage: UiLanguage = profile?.locale === "en" ? "en" : "pl";

  return <TranslatorWorkspace uiLanguage={uiLanguage} />;
}
