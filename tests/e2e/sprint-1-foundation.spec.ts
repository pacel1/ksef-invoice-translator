import { test, expect } from "@playwright/test";

test("404 page renders with new brand chrome", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /Nie znaleziono/i })).toBeVisible();
  await expect(page.getByText("404")).toBeVisible();
  await expect(page.getByRole("link", { name: /Tłumacz Faktur KSeF/i })).toBeVisible();
  await expect(page.getByText(/NIP/i)).toBeVisible(); // LegalFooter present
  const cta = page.getByRole("link", { name: /Wracam na stronę główną/i });
  await expect(cta).toHaveAttribute("href", "/");
});
