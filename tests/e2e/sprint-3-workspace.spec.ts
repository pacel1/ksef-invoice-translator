import path from "node:path";
import { admin, expect, signIn, test } from "./helpers/auth";

/**
 * Sidebar + history coverage that survived the Tłumacz cutover (PR #E).
 * URLs and labels updated for the new /translate route; behavior is
 * otherwise identical to the Sprint 3 version.
 */

const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

test("sidebar renders with the New Translation CTA pointing at /translate", async ({
  page,
  testUser
}) => {
  await signIn(page, testUser.email);
  // Sidebar is `hidden md:flex` — Playwright's default viewport is 1280x720 (md+).
  const cta = page.getByRole("link", { name: /Nowe tłumaczenie/i }).first();
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/translate");

  const archiveLink = page.getByRole("link", { name: /Historia/i });
  await expect(archiveLink).toHaveAttribute("href", "/translate/history");
});

test("/translate/history renders empty state when user has no invoices", async ({
  page,
  testUser
}) => {
  await signIn(page, testUser.email);
  await page.goto("/translate/history");
  await expect(
    page.getByRole("heading", { level: 1, name: /Historia faktur/i })
  ).toBeVisible();
  await expect(page.getByText(/Brak faktur do wyświetlenia/i)).toBeVisible();
});

test("uploaded invoice appears in sidebar and history table", async ({
  page,
  testUser
}) => {
  await signIn(page, testUser.email);
  await page.goto("/translate");

  // Upload an invoice via the wizard's Step 1 drop zone.
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Przeciągnij pliki lub wybierz z dysku/i).click();
  const chooser = await chooserPromise;
  const [uploadResponse] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/api/upload-batch") && r.request().method() === "POST"
    ),
    chooser.setFiles(samplePath)
  ]);
  expect(uploadResponse.status()).toBe(200);

  // Source-of-truth check: the row should exist for this user.
  const { data: invoiceRows } = await admin
    .from("invoices")
    .select("id")
    .eq("user_id", testUser.userId);
  expect(invoiceRows).toHaveLength(1);

  // Reload — the sidebar reads recent invoices server-side; needs a roundtrip.
  await page.reload();

  // Sidebar should now show at least one invoice with PL pill.
  const sidebarPL = page.locator("aside").getByText("PL").first();
  await expect(sidebarPL).toBeVisible();

  // Navigate to history via the renamed Historia link.
  await page.getByRole("link", { name: /Historia/i }).click();
  await expect(page).toHaveURL(/\/translate\/history$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Historia faktur/i })
  ).toBeVisible();

  // The uploaded invoice should appear as a row.
  await expect(page.getByText(/Brak faktur do wyświetlenia/i)).not.toBeVisible();
  // Row has an Open link.
  await expect(page.getByRole("link", { name: /Otwórz/i }).first()).toBeVisible();
});
