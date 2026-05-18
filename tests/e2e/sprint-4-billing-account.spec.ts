import { admin, expect, signIn, test } from "./helpers/auth";

test("billing page shows the new stat band + slider + included list", async ({ page, testUser }) => {
  await signIn(page, testUser.email);
  await page.goto("/billing");
  await expect(page.getByText(/kredytów/i).first()).toBeVisible();
  await expect(page.getByText(/Następne darmowe odnowienie/i)).toBeVisible();
  await expect(page.locator("#slider")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Co dostajesz w cenie/i })).toBeVisible();
  await expect(page.getByText(/Ceny netto/i)).toBeVisible();
});

test("/account renders profile + export + danger zone sections", async ({ page, testUser }) => {
  await signIn(page, testUser.email);
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1, name: /Konto/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Profil/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Eksport danych/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Strefa niebezpieczna/i })).toBeVisible();
  await expect(page.getByText(testUser.email).first()).toBeVisible();
});

test("danger zone opens delete-account modal but cancel returns safely", async ({ page, testUser }) => {
  await signIn(page, testUser.email);
  await page.goto("/account");
  const deleteBtn = page.getByRole("button", { name: /Usuń konto/i }).first();
  await deleteBtn.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Potwierdź usunięcie konta/i })).toBeVisible();
  await page.getByRole("button", { name: /Anuluj/i }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("low-balance banner's Buy button opens the credit drawer", async ({ page, testUser }) => {
  await admin.rpc("ensure_free_credit_for_period", { p_user: testUser.userId });
  await admin
    .from("credit_balances")
    .update({ free_credits_remaining: 0, paid_credits: 0 })
    .eq("user_id", testUser.userId);
  await signIn(page, testUser.email);

  const banner = page.getByRole("status");
  await expect(banner).toBeVisible();
  const buy = banner.getByRole("button", { name: /Kup pakiet/i });
  await buy.click();
  await expect(page.locator("[data-drawer-open='true']")).toBeVisible();
  await expect(page.locator("[data-drawer-open='true']").getByRole("slider")).toBeVisible();
});

test("credit drawer closes via X button", async ({ page, testUser }) => {
  await admin.rpc("ensure_free_credit_for_period", { p_user: testUser.userId });
  await admin
    .from("credit_balances")
    .update({ free_credits_remaining: 0, paid_credits: 0 })
    .eq("user_id", testUser.userId);
  await signIn(page, testUser.email);

  await page.getByRole("status").getByRole("button", { name: /Kup pakiet/i }).click();
  const drawer = page.locator("[data-drawer-open='true']");
  await expect(drawer).toBeVisible();

  await drawer.getByRole("button", { name: /Zamknij/i }).click();
  await expect(drawer).not.toBeVisible();
});
