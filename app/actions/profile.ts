"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export interface UpdateProfileInput {
  locale?: "pl" | "en";
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export async function updateProfile(
  input: UpdateProfileInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const admin = getSupabaseAdminClient();

  const updates: {
    locale?: string;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } = {};
  if (input.locale === "pl" || input.locale === "en") updates.locale = input.locale;
  if (input.displayName !== undefined) {
    updates.display_name = input.displayName?.trim() || null;
  }
  if (input.firstName !== undefined) {
    updates.first_name = input.firstName?.trim() || null;
  }
  if (input.lastName !== undefined) {
    updates.last_name = input.lastName?.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true };
  }

  const { error } = await admin.from("profiles").update(updates).eq("id", user.id);
  if (error) {
    console.error("[updateProfile] failed:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/account");
  revalidatePath("/translate");
  return { ok: true };
}
