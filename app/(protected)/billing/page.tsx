import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { copy, type UiLanguage } from "@/lib/workspace/copy";

export default async function BillingPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();
  const uiLanguage: UiLanguage = profile?.locale === "en" ? "en" : "pl";
  const t = copy[uiLanguage];

  return (
    <section className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-16 text-center shadow-soft">
        <CreditCard className="mx-auto mb-4 h-10 w-10 text-cyan-700" />
        <h1 className="text-2xl font-semibold text-slate-950">{String(t.billingPlaceholderTitle)}</h1>
        <p className="mx-auto mt-3 max-w-md text-slate-600">{String(t.billingPlaceholderBody)}</p>
        <div className="mt-6">
          <Link
            href="/app"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            ← Workspace
          </Link>
        </div>
      </div>
    </section>
  );
}
