import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("profile bootstrap trigger", () => {
  it("inserts a profile row when a user signs up", async () => {
    const email = `test-${Date.now()}@example.test`;
    const { data: user, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true
    });
    expect(error).toBeNull();
    const userId = user.user!.id;

    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, locale")
      .eq("id", userId)
      .single();

    expect(profile).toEqual({ id: userId, email, locale: "pl" });

    await admin.auth.admin.deleteUser(userId);
  });
});
