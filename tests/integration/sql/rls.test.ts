import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function makeUser(label: string) {
  const email = `rls-${label}-${Date.now()}@example.test`;
  const password = "Test123!Test123!";
  const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const userClient = createClient(url, anon, { auth: { persistSession: false } });
  await userClient.auth.signInWithPassword({ email, password });
  return { id: created.user!.id, client: userClient };
}

describe("RLS policies", () => {
  it("user A cannot read user B's invoices", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");

    await admin.from("invoices").insert({
      user_id: b.id,
      source_type: "xml",
      source_hash: "rls-hash",
      source_size: 1,
      source_data: {}
    });

    const { data, error } = await a.client.from("invoices").select("id").eq("user_id", b.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);

    await admin.auth.admin.deleteUser(a.id);
    await admin.auth.admin.deleteUser(b.id);
  });

  it("user cannot directly write to credit_balances", async () => {
    const u = await makeUser("write");
    const { error } = await u.client.from("credit_balances").insert({
      user_id: u.id,
      paid_credits: 999,
      free_credits_remaining: 0
    });
    expect(error?.message ?? "").toMatch(/row-level security|policy/i);

    await admin.auth.admin.deleteUser(u.id);
  });
});
