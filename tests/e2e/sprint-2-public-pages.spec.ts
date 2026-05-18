import { test, expect } from "@playwright/test";

test("landing page (/) renders with new chrome", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Faktura KSeF dla klienta z zagranicy/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Zacznij za darmo/i })).toHaveAttribute("href", "/login");
  await expect(page.getByText(/NIP/)).toBeVisible(); // LegalFooter
});

test("EN landing page (/en) renders", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1, name: /Polish KSeF invoice, translated/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start free/i })).toBeVisible();
});

test("pricing page renders the slider + ladder", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1, name: /Cennik prosty jak faktura/i })).toBeVisible();
  await expect(page.getByRole("slider")).toBeVisible();
  await expect(page.getByRole("cell", { name: "5", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "100", exact: true })).toBeVisible();
});

test("security page renders TL;DR + sub-processors", async ({ page }) => {
  await page.goto("/security");
  await expect(page.getByRole("heading", { level: 1, name: /Bezpieczeństwo i prywatność danych/i })).toBeVisible();
  await expect(page.getByText(/Wszystkie dane w UE/)).toBeVisible();
  await expect(page.getByText("Supabase").first()).toBeVisible();
  await expect(page.getByText("OpenAI").first()).toBeVisible();
});

test("terms page renders the TOC + content stub", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: /Regulamin/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Spis treści/i })).toBeVisible();
});

test("privacy page renders the TOC + content stub", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: /Polityka prywatności/i })).toBeVisible();
});

test("login page renders with new chrome", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Zaloguj się/i })).toBeVisible();
  await expect(page.getByLabel(/Adres e-mail/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Wyślij link logowania/i })).toBeVisible();
});

test("auth error page renders expired variant via ?reason=expired", async ({ page }) => {
  await page.goto("/auth/error?reason=expired");
  await expect(page.getByRole("heading", { name: /Link wygasł/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Wyślij nowy link/i })).toHaveAttribute("href", "/login");
});

test("auth error page falls back to generic for unknown reasons", async ({ page }) => {
  await page.goto("/auth/error?reason=random");
  await expect(page.getByRole("heading", { name: /Coś poszło nie tak/i })).toBeVisible();
});

test("public header CTA links to /login", async ({ page }) => {
  await page.goto("/pricing");
  const cta = page.getByRole("link", { name: /Zaloguj się/i });
  await expect(cta).toHaveAttribute("href", "/login");
});
