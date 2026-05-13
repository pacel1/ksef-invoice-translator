import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("stripe_purchases table", () => {
  it("rejects package_size outside [5, 100]", async () => {
    const { data: user } = await admin.auth.admin.createUser({
      email: `sp-${Date.now()}@example.test`,
      email_confirm: true
    });
    const userId = user.user!.id;

    const { error } = await admin.from("stripe_purchases").insert({
      user_id: userId,
      stripe_checkout_session_id: `cs_${Date.now()}`,
      package_size: 4,
      unit_price_cents: 699,
      total_amount_cents: 2796,
      status: "pending"
    });
    expect(error?.message ?? "").toMatch(/check constraint|violates/);

    await admin.auth.admin.deleteUser(userId);
  });
});
