import path from "node:path";
import { admin, expect, signIn, test } from "./helpers/auth";

const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

test("balance chip links to /billing", async ({ page, testUser }) => {
  await signIn(page, testUser.email);

  const chip = page.getByRole("link", { name: /Top up|Doładuj/i });
  await expect(chip).toHaveAttribute("href", "/billing");
});

test("zero-balance shows the proactive banner with a Buy credits link", async ({ page, testUser }) => {
  // Drain credits before sign-in so the banner is rendered SSR-side.
  await admin.rpc("ensure_free_credit_for_period", { p_user: testUser.userId });
  await admin
    .from("credit_balances")
    .update({ free_credits_remaining: 0, paid_credits: 0 })
    .eq("user_id", testUser.userId);

  await signIn(page, testUser.email);
  const banner = page.getByRole("status");
  await expect(banner).toBeVisible();
  await expect(banner.getByText(/Brak kredytów|Out of credits/i)).toBeVisible();
  const buy = banner.getByRole("button", { name: /Kup pakiet|Buy credits/i });
  await expect(buy).toBeVisible();
});

test("clicking a language pill switches the active language and caches it", async ({ page, testUser }) => {
  await signIn(page, testUser.email);

  // Upload first.
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await chooserPromise;
  const [uploadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  expect(uploadResponse.status()).toBe(200);

  // Default is PL — upload does not auto-translate. The PL pill is aria-pressed.
  await expect(page.getByRole("button", { name: /^PL/ })).toHaveAttribute("aria-pressed", "true");

  // Click EN — should trigger a translate.
  const [firstTranslate] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/translate") && r.request().method() === "POST",
      { timeout: 30_000 }
    ),
    page.getByRole("button", { name: /^EN/ }).click()
  ]);
  expect(firstTranslate.status()).toBe(200);
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
});

test("clicking 'New invoice' resets the workspace to the empty state", async ({ page, testUser }) => {
  await signIn(page, testUser.email);

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await chooserPromise;
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  // Default is PL — no auto-translate. Wait for the workspace to settle into
  // the invoice view by asserting the toolbar's New invoice button is present.
  await expect(page.getByRole("button", { name: /Nowa faktura|New invoice/i })).toBeVisible();

  // Click New invoice.
  await page.getByRole("button", { name: /Nowa faktura|New invoice/i }).click();

  // Drop zone is back.
  await expect(page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i)).toBeVisible();
});
