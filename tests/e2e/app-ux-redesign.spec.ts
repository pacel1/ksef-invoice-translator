import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

async function signIn(page: import("@playwright/test").Page, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error("generateLink failed");
  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}&type=email`);
  await expect(page).toHaveURL(/\/app$/);
}

async function deleteUser(email: string) {
  const { data } = await admin.auth.admin.listUsers();
  const created = data.users.find((u) => u.email === email);
  if (created) await admin.auth.admin.deleteUser(created.id);
}

test("balance chip links to /billing", async ({ page }) => {
  const email = `ux-chip-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signIn(page, email);

  const chip = page.getByRole("link", { name: /Top up|Doładuj/i });
  await expect(chip).toHaveAttribute("href", "/billing");

  await deleteUser(email);
});

test("zero-balance shows the proactive banner with a Buy credits link", async ({ page }) => {
  const email = `ux-banner-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  // Drain credits before sign-in so the banner is rendered SSR-side.
  const { data: usersData } = await admin.auth.admin.listUsers();
  const userId = usersData.users.find((u) => u.email === email)?.id!;
  await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
  await admin
    .from("credit_balances")
    .update({ free_credits_remaining: 0, paid_credits: 0 })
    .eq("user_id", userId);

  await signIn(page, email);
  const banner = page.getByRole("status");
  await expect(banner).toBeVisible();
  await expect(banner.getByText(/Brak kredytów|Out of credits/i)).toBeVisible();
  const buy = banner.getByRole("link", { name: /Kup pakiet|Buy credits/i });
  await expect(buy).toHaveAttribute("href", "/billing");

  await deleteUser(email);
});

test("clicking a language pill switches the active language and caches it", async ({ page }) => {
  const email = `ux-pills-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signIn(page, email);

  // Upload first.
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await chooserPromise;
  const [uploadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  expect(uploadResponse.status()).toBe(200);

  // Wait for the implicit EN translate.
  await page.waitForResponse(
    (r) => r.url().includes("/api/translate") && r.request().method() === "POST",
    { timeout: 30_000 }
  );

  // EN pill should now show aria-pressed=true.
  await expect(page.getByRole("button", { name: /^EN/ })).toHaveAttribute("aria-pressed", "true");

  // Click DE — should trigger another translate.
  const [secondTranslate] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/translate") && r.request().method() === "POST"
    ),
    page.getByRole("button", { name: /^DE/ }).click()
  ]);
  expect(secondTranslate.status()).toBe(200);
  await expect(page.getByRole("button", { name: /^DE/ })).toHaveAttribute("aria-pressed", "true");

  // Click back to EN — should be a no-op (cached, no new API call within 2s).
  let calls = 0;
  const listener = (response: import("@playwright/test").Response) => {
    if (response.url().includes("/api/translate")) calls++;
  };
  page.on("response", listener);
  await page.getByRole("button", { name: /^EN/ }).click();
  await page.waitForTimeout(2000);
  page.off("response", listener);
  expect(calls).toBe(0);
  await expect(page.getByRole("button", { name: /^EN/ })).toHaveAttribute("aria-pressed", "true");

  await deleteUser(email);
});

test("clicking 'New invoice' resets the workspace to the empty state", async ({ page }) => {
  const email = `ux-reset-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signIn(page, email);

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await chooserPromise;
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  await page.waitForResponse(
    (r) => r.url().includes("/api/translate") && r.request().method() === "POST",
    { timeout: 30_000 }
  );

  // Click New invoice.
  await page.getByRole("button", { name: /Nowa faktura|New invoice/i }).click();

  // Drop zone is back.
  await expect(page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i)).toBeVisible();

  await deleteUser(email);
});
