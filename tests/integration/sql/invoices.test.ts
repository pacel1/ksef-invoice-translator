import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("invoices table", () => {
  it("enforces unique (user_id, source_hash) on live rows only", async () => {
    const { data: user } = await admin.auth.admin.createUser({
      email: `inv-${Date.now()}@example.test`,
      email_confirm: true
    });
    const userId = user.user!.id;

    const row = {
      user_id: userId,
      source_type: "xml" as const,
      source_hash: "abc123",
      source_size: 100,
      source_data: { hello: "world" }
    };

    const { data: first } = await admin.from("invoices").insert(row).select().single();
    expect(first?.id).toBeTruthy();

    const { error: dupError } = await admin.from("invoices").insert(row);
    expect(dupError?.message ?? "").toMatch(/duplicate|unique/);

    await admin.from("invoices").update({ deleted_at: new Date().toISOString() }).eq("id", first!.id);
    const { error: afterDeleteError } = await admin.from("invoices").insert(row);
    expect(afterDeleteError).toBeNull();

    await admin.auth.admin.deleteUser(userId);
  });
});
