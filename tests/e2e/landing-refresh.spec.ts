import { test, expect } from "@playwright/test";

test.describe("landing refresh — PL", () => {
  test("renders hero, how-it-works, risk-reversal and links to /login", async ({ page }) => {
    await page.goto("/");

    // Hero
    await expect(
      page.getByRole("heading", { level: 1, name: /Faktura KSeF dla klienta z zagranicy/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Zacznij za darmo/i }).first()
    ).toHaveAttribute("href", "/login");

    // New sections
    await expect(
      page.getByRole("heading", { name: /Od pliku KSeF do gotowego PDF/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Zacznij bez ryzyka/i })
    ).toBeVisible();

    // Footer still present
    await expect(page.getByText(/NIP/).first()).toBeVisible();
  });

  test("no longer renders the removed sections", async ({ page }) => {
    await page.goto("/");
    // Founder heading removed
    await expect(page.getByText(/Stoi za tym konkretny człowiek/i)).toHaveCount(0);
    // Beta testimonials badge removed
    await expect(page.getByText(/Beta — pierwsze opinie/i)).toHaveCount(0);
  });
});

test.describe("landing refresh — EN", () => {
  test("renders translated hero + new sections", async ({ page }) => {
    await page.goto("/en");
    await expect(
      page.getByRole("heading", { level: 1, name: /Polish KSeF invoice, translated/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /From a KSeF file to a ready PDF/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Start with zero risk/i })
    ).toBeVisible();
  });
});
