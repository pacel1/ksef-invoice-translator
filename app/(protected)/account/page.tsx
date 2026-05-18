import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { ProfileSection } from "@/components/account/profile-section";
import { DataExportSection } from "@/components/account/data-export-section";
import { DangerZone } from "@/components/account/danger-zone";
import { copy } from "@/lib/workspace/copy";

export default async function AccountPage() {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);

  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, locale")
    .eq("id", user.id)
    .single();

  const t = copy[uiLanguage];

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-h1 text-text-strong">{String(t.accountTitle)}</h1>

      <ProfileSection
        email={user.email ?? ""}
        initialLocale={uiLanguage}
        initialDisplayName={profile?.display_name ?? ""}
        labels={{
          heading: String(t.accountProfileHeading),
          emailLabel: String(t.accountEmailLabel),
          emailHelp: String(t.accountEmailHelp),
          localeLabel: String(t.accountLocaleLabel),
          displayNameLabel: String(t.accountDisplayNameLabel),
          displayNameHelp: String(t.accountDisplayNameHelp),
          saveButton: String(t.accountSaveButton),
          savingButton: String(t.accountSavingButton),
          saveSuccess: String(t.accountSaveSuccess),
          saveError: String(t.accountSaveError)
        }}
      />

      <DataExportSection
        labels={{
          heading: String(t.accountExportHeading),
          body: String(t.accountExportBody),
          button: String(t.accountExportButton),
          preparing: String(t.accountExportPreparing)
        }}
      />

      <DangerZone
        email={user.email ?? ""}
        labels={{
          heading: String(t.accountDangerHeading),
          deleteTitle: String(t.accountDeleteAccountTitle),
          deleteBody: String(t.accountDeleteAccountBody),
          deleteButton: String(t.accountDeleteAccountButton),
          modal: {
            title: String(t.accountDeleteConfirmTitle),
            body: String(t.accountDeleteConfirmBody),
            placeholder: String(t.accountDeleteConfirmPlaceholder),
            confirmAction: String(t.accountDeleteConfirmAction),
            cancel: String(t.accountDeleteCancel)
          }
        }}
      />
    </section>
  );
}
