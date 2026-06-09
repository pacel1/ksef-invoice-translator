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

test("mobile nav sheet paints above the page (no stacking bleed-through)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/landing-preview");
  await page.getByRole("button", { name: "Otwórz menu" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const onTop = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return false;
    const r = d.getBoundingClientRect();
    const el = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return !!(el && d.contains(el));
  });
  expect(onTop).toBe(true);
});
