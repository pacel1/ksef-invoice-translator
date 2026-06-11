import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("invoices table", () => {
  it("allows duplicate (user_id, source_hash) inserts as distinct rows", async () => {
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

    const { data: first, error: firstError } = await admin.from("invoices").insert(row).select().single();
    expect(firstError).toBeNull();
    expect(first?.id).toBeTruthy();

    // Since migration 20260521000001 re-uploads of the same file are
    // intentionally NOT rejected: each insert is its own row.
    const { data: second, error: dupError } = await admin.from("invoices").insert(row).select().single();
    expect(dupError).toBeNull();
    expect(second?.id).toBeTruthy();
    expect(second!.id).not.toBe(first!.id);

    // Pre-upload duplicate warnings are computed from a COUNT of live
    // rows sharing the hash, so both rows must be visible to that count.
    const { count: liveCount } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("source_hash", row.source_hash)
      .is("deleted_at", null);
    expect(liveCount).toBe(2);

    // Soft-deleted rows drop out of the live count.
    await admin.from("invoices").update({ deleted_at: new Date().toISOString() }).eq("id", first!.id);
    const { count: afterDeleteCount } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("source_hash", row.source_hash)
      .is("deleted_at", null);
    expect(afterDeleteCount).toBe(1);

    await admin.auth.admin.deleteUser(userId);
  });
});
