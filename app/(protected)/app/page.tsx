import { TranslatorWorkspace } from "@/components/workspace/translator-workspace";
import { LowBalanceBanner } from "@/components/billing/low-balance-banner";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { copy, type UiLanguage } from "@/lib/workspace/copy";

export default async function AppPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();

  const uiLanguage: UiLanguage = profile?.locale === "en" ? "en" : "pl";
  const t = copy[uiLanguage];

  const admin = getSupabaseAdminClient();
  await admin.rpc("ensure_free_credit_for_period", { p_user: user.id });
  const { data: balance } = await admin
    .from("credit_balances")
    .select("free_credits_remaining, paid_credits")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <>
      <LowBalanceBanner
        initialFree={balance?.free_credits_remaining ?? 0}
        initialPaid={balance?.paid_credits ?? 0}
        title={String(t.lowBalanceBannerTitle)}
        body={String(t.lowBalanceBannerBody)}
        buyLabel={String(t.buyCredits)}
        closeLabel={String(t.close)}
      />
      <TranslatorWorkspace uiLanguage={uiLanguage} />
    </>
  );
}
