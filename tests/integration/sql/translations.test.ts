import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("translations table", () => {
  it("enforces unique (invoice_id, language, bilingual)", async () => {
    const { data: user } = await admin.auth.admin.createUser({
      email: `tr-${Date.now()}@example.test`,
      email_confirm: true
    });
    const userId = user.user!.id;

    const { data: inv } = await admin
      .from("invoices")
      .insert({
        user_id: userId,
        source_type: "xml",
        source_hash: "h",
        source_size: 1,
        source_data: {}
      })
      .select()
      .single();

    const row = {
      invoice_id: inv!.id,
      language: "en",
      bilingual: true,
      translated_data: { ok: 1 },
      used_ai: false
    };

    const { error: ok } = await admin.from("translations").insert(row);
    expect(ok).toBeNull();

    const { error: dup } = await admin.from("translations").insert(row);
    expect(dup?.message ?? "").toMatch(/duplicate|unique/);

    const { error: otherLanguage } = await admin
      .from("translations")
      .insert({ ...row, language: "de" });
    expect(otherLanguage).toBeNull();

    await admin.auth.admin.deleteUser(userId);
  });
});
