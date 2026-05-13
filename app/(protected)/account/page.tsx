import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, locale, created_at")
    .eq("id", user.id)
    .single();

  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Konto</h1>
      <dl className="mt-6 grid gap-3 text-sm">
        <div className="flex justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
          <dt className="text-slate-500">Email</dt>
          <dd className="font-medium text-slate-900">{user.email}</dd>
        </div>
        <div className="flex justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
          <dt className="text-slate-500">Język interfejsu</dt>
          <dd className="font-medium text-slate-900">{profile?.locale ?? "pl"}</dd>
        </div>
        <div className="flex justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
          <dt className="text-slate-500">Konto utworzone</dt>
          <dd className="font-medium text-slate-900">
            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pl-PL") : "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
