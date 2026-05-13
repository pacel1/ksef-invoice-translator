import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

async function signInViaTokenHash(page: import("@playwright/test").Page, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    throw new Error("generateLink failed");
  }
  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}&type=email`);
  await expect(page).toHaveURL(/\/app$/);
}

async function deleteUser(email: string) {
  const { data } = await admin.auth.admin.listUsers();
  const created = data.users.find((u) => u.email === email);
  if (created) await admin.auth.admin.deleteUser(created.id);
}

test("authenticated user can upload, translate, and download an invoice", async ({ page }) => {
  const email = `workspace-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signInViaTokenHash(page, email);

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await fileChooserPromise;
  await chooser.setFiles(samplePath);

  await expect(page.getByText(/Faktura|Invoice/)).toBeVisible({ timeout: 20_000 });
  // Source-of-truth check: the row should exist for this user.
  const { data: invoiceRows } = await admin
    .from("invoices")
    .select("id, source_type")
    .order("created_at", { ascending: false })
    .limit(5);
  expect(invoiceRows?.[0]?.source_type).toBe("xml");

  // Translate.
  await page.getByRole("button", { name: /Tłumacz opisy|Translate descriptions/i }).click();

  // Download PDF — assert the network response.
  const [downloadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/pdf") && r.request().method() === "POST"),
    page.getByRole("button", { name: /Pobierz PDF|Download PDF/i }).click()
  ]);
  expect(downloadResponse.status()).toBe(200);
  expect(downloadResponse.headers()["content-type"]).toContain("application/pdf");

  await deleteUser(email);
});
