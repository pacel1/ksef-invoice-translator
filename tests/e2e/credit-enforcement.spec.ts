import path from "node:path";
import { admin, expect, signIn, test } from "./helpers/auth";

const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

test("free credit is consumed on the first new upload", async ({ page, testUser }) => {
  await signIn(page, testUser.email);

  // Header shows "1 darmowy kredyt / free credit · 0 kredytów / credits" pre-upload.
  await expect(page.getByText(/1 (darmowy kredyt|free credit)/i).first()).toBeVisible();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await chooserPromise;
  const [uploadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  expect(uploadResponse.status()).toBe(200);

  // Balance should drop to zero. With the redesign, the chip switches to its amber
  // "Brak kredytów / Out of credits" variant and the LowBalanceBanner appears — either
  // surface confirms the credit was consumed.
  await expect(page.getByText(/Brak kredytów|Out of credits/i).first()).toBeVisible({ timeout: 10_000 });

  const { data: bal } = await admin
    .from("credit_balances")
    .select("free_credits_remaining, paid_credits")
    .eq("user_id", testUser.userId)
    .single();
  expect(bal).toMatchObject({ free_credits_remaining: 0, paid_credits: 0 });
});

test("dedupe re-upload does not consume a credit", async ({ page, testUser }) => {
  // Pre-give the user paid credits so the first upload uses paid, and we can
  // still upload a second time without bumping into the free-tier reset logic.
  await admin.rpc("ensure_free_credit_for_period", { p_user: testUser.userId });
  await admin
    .from("credit_balances")
    .update({ free_credits_remaining: 0, paid_credits: 3 })
    .eq("user_id", testUser.userId);

  await signIn(page, testUser.email);

  // First upload — consumes one paid credit.
  let chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  let chooser = await chooserPromise;
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  // Reload to clear the workspace state and re-arm the drop zone.
  await page.reload();
  await page.waitForLoadState("networkidle");

  // Second upload of the same bytes — dedupe hit, no credit consumed.
  chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  chooser = await chooserPromise;
  const [secondResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  expect(secondResponse.status()).toBe(200);
  const payload = await secondResponse.json();
  expect(payload.isNew).toBe(false);

  const { data: bal } = await admin
    .from("credit_balances")
    .select("free_credits_remaining, paid_credits")
    .eq("user_id", testUser.userId)
    .single();
  expect(bal).toMatchObject({ free_credits_remaining: 0, paid_credits: 2 });
});

test("upload at zero balance returns 402 and shows the modal", async ({ page, testUser }) => {
  await signIn(page, testUser.email);

  // Drain the balance directly.
  await admin.rpc("ensure_free_credit_for_period", { p_user: testUser.userId });
  await admin
    .from("credit_balances")
    .update({ free_credits_remaining: 0, paid_credits: 0 })
    .eq("user_id", testUser.userId);

  // Reload so the chip picks up the drained balance.
  await page.reload();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await chooserPromise;
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  expect(response.status()).toBe(402);
  const payload = await response.json();
  expect(payload.code).toBe("insufficient_credit");

  // Modal should be visible.
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText(/Brak kredytów|Out of credits/i)).toBeVisible();

  // The Buy-credits link inside the modal should point to /billing.
  // Scope to the dialog — the LowBalanceBanner also shows a "Kup pakiet" link.
  const buy = page.getByRole("dialog").getByRole("link", { name: /Kup pakiet|Buy credits/i });
  await expect(buy).toHaveAttribute("href", "/billing");
});
