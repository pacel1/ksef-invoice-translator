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

  // Trigger the upload and wait for the network response — deterministic, no text-match races.
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await fileChooserPromise;
  const [uploadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST", { timeout: 30_000 }),
    chooser.setFiles(samplePath)
  ]);
  expect(uploadResponse.status()).toBe(200);

  // Source-of-truth check: the row should exist FOR THIS user (scoped, not "the 5 newest").
  const { data: createdUser } = await admin.auth.admin.listUsers();
  const userId = createdUser.users.find((u) => u.email === email)?.id;
  expect(userId).toBeTruthy();
  const { data: invoiceRows } = await admin
    .from("invoices")
    .select("id, source_type")
    .eq("user_id", userId!);
  expect(invoiceRows).toHaveLength(1);
  expect(invoiceRows![0].source_type).toBe("xml");

  // Translate — wait for the translate response before clicking the PDF button so
  // OpenAI latency doesn't bleed into the PDF response timeout.
  const [translateResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/translate") && r.request().method() === "POST"),
    page.getByRole("button", { name: /Tłumacz opisy|Translate descriptions/i }).click()
  ]);
  expect(translateResponse.status()).toBe(200);

  // Download PDF — assert the network response.
  const [downloadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/pdf") && r.request().method() === "POST", { timeout: 60_000 }),
    page.getByRole("button", { name: /Pobierz PDF|Download PDF/i }).click()
  ]);
  expect(downloadResponse.status()).toBe(200);
  expect(downloadResponse.headers()["content-type"]).toContain("application/pdf");

  await deleteUser(email);
});
