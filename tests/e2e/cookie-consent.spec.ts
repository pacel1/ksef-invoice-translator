import { test, expect, type Page } from "@playwright/test";

const CONSENT_COOKIE = "cookie_consent";

async function readConsentCookie(page: Page) {
  const cookies = await page.context().cookies();
  const cookie = cookies.find((c) => c.name === CONSENT_COOKIE);
  if (!cookie) return null;
  return JSON.parse(decodeURIComponent(cookie.value)) as {
    necessary: boolean;
    analytics: boolean;
    marketing: boolean;
  };
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test("first visit shows the banner; accept all persists and survives reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Akceptuję wszystkie" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Odrzucam wszystkie" })).toBeVisible();

  await page.getByRole("button", { name: "Akceptuję wszystkie" }).click();
  await expect(page.getByRole("button", { name: "Akceptuję wszystkie" })).toBeHidden();

  expect(await readConsentCookie(page)).toMatchObject({
    necessary: true,
    analytics: true,
    marketing: true
  });

  await page.reload();
  await expect(page.getByText("TłumaczKSeF").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Akceptuję wszystkie" })).toBeHidden();
});

test("reject all declines optional categories and loads no Google scripts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Odrzucam wszystkie" }).click();

  expect(await readConsentCookie(page)).toMatchObject({
    necessary: true,
    analytics: false,
    marketing: false
  });

  const googleScripts = await page.evaluate(
    () => document.querySelectorAll("script[src*='googletagmanager']").length
  );
  expect(googleScripts).toBe(0);
});

test("granular choice via settings modal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Ustawienia plików cookies" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("switch", { name: /Niezbędne/ })).toBeDisabled();

  await dialog.getByRole("switch", { name: /Marketingowe/ }).click();
  await dialog.getByRole("button", { name: "Zapisz wybór" }).click();
  await expect(dialog).toBeHidden();

  expect(await readConsentCookie(page)).toMatchObject({
    analytics: false,
    marketing: true
  });
});

test("footer link reopens settings after a decision was made", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Akceptuję wszystkie" }).click();

  await page.getByRole("button", { name: "Ustawienia cookies" }).first().click();
  await expect(page.getByRole("dialog", { name: "Ustawienia plików cookies" })).toBeVisible();
});

test("English pages show English banner copy", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("button", { name: "Accept all" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reject all" })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Cookie settings" })).toBeVisible();
});
