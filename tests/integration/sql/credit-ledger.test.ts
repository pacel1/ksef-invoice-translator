import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("credit_ledger table", () => {
  it("rejects bad event_type", async () => {
    const { data: user } = await admin.auth.admin.createUser({
      email: `cl-${Date.now()}@example.test`,
      email_confirm: true
    });
    const userId = user.user!.id;

    const { error } = await admin.from("credit_ledger").insert({
      user_id: userId,
      event_type: "nonsense",
      delta_paid: 0,
      delta_free: 0,
      balance_paid_after: 0,
      balance_free_after: 0
    });
    expect(error?.message ?? "").toMatch(/check constraint|violates/);

    await admin.auth.admin.deleteUser(userId);
  });
});
