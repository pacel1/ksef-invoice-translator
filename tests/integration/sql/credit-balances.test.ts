import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("credit_balances table", () => {
  it("has expected columns and check constraints", async () => {
    const email = `cb-${Date.now()}@example.test`;
    const { data: user } = await admin.auth.admin.createUser({ email, email_confirm: true });
    const userId = user.user!.id;

    const { error: insertError } = await admin
      .from("credit_balances")
      .insert({ user_id: userId, paid_credits: 0, free_credits_remaining: 0 });
    expect(insertError).toBeNull();

    const { error: negError } = await admin
      .from("credit_balances")
      .update({ paid_credits: -1 })
      .eq("user_id", userId);
    expect(negError?.message ?? "").toMatch(/check constraint|violates/);

    await admin.auth.admin.deleteUser(userId);
  });
});
