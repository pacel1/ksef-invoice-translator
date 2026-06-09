import { test, expect } from "@playwright/test";

test("landing rebuild preview renders chrome with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/landing-preview");

  await expect(page.getByText("TłumaczKSeF").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Wgraj pierwszą fakturę/i })).toBeVisible();
  await expect(page.getByText(/Dane w UE \(Frankfurt\)/i)).toBeVisible();
  // primary nav CTA points to /login
  await expect(page.getByRole("link", { name: "Zacznij za darmo" }).first()).toHaveAttribute("href", "/login");

  expect(errors).toEqual([]);
});

test("landing rebuild preview has no horizontal overflow at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/landing-preview");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(overflow).toBe(false);
});
