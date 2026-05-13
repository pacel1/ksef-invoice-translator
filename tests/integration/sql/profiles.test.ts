import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("profiles table", () => {
  it("accepts a row with default locale 'pl' for a real auth user", async () => {
    const email = `prof-${Date.now()}@example.test`;
    const { data: user } = await admin.auth.admin.createUser({ email, email_confirm: true });
    const userId = user.user!.id;

    // Trigger from Task 7 may or may not have inserted the row yet — upsert handles both cases.
    const { error: upsertError } = await admin.from("profiles").upsert({ id: userId, email });
    expect(upsertError).toBeNull();

    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, locale")
      .eq("id", userId)
      .single();
    expect(profile?.email).toBe(email);
    expect(profile?.locale).toBe("pl");

    await admin.auth.admin.deleteUser(userId);
  });

  it("rejects an invalid locale", async () => {
    const email = `prof-bad-${Date.now()}@example.test`;
    const { data: user } = await admin.auth.admin.createUser({ email, email_confirm: true });
    const userId = user.user!.id;

    const { error } = await admin.from("profiles").update({ locale: "de" }).eq("id", userId);
    expect(error?.message ?? "").toMatch(/check constraint|violates/);

    await admin.auth.admin.deleteUser(userId);
  });
});
