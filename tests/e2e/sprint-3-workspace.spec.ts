import path from "node:path";
import { admin, expect, signIn, test } from "./helpers/auth";

const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

test("workspace sidebar renders with new-invoice CTA", async ({ page, testUser }) => {
  await signIn(page, testUser.email);
  // Sidebar is `hidden md:flex` — Playwright's default viewport is 1280x720 (md+).
  const newInvoice = page.getByRole("link", { name: /Nowa faktura/i }).first();
  await expect(newInvoice).toBeVisible();
  await expect(newInvoice).toHaveAttribute("href", "/app");

  const archiveLink = page.getByRole("link", { name: /Cały archiwum/i });
  await expect(archiveLink).toHaveAttribute("href", "/app/history");
});

test("/app/history renders empty state when user has no invoices", async ({ page, testUser }) => {
  await signIn(page, testUser.email);
  await page.goto("/app/history");
  await expect(page.getByRole("heading", { level: 1, name: /Historia faktur/i })).toBeVisible();
  await expect(page.getByText(/Brak faktur do wyświetlenia/i)).toBeVisible();
});

test("uploaded invoice appears in sidebar and history table", async ({ page, testUser }) => {
  await signIn(page, testUser.email);

  // Upload an invoice.
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await chooserPromise;
  const [uploadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  expect(uploadResponse.status()).toBe(200);

  // Source-of-truth check: the row should exist for this user.
  const { data: invoiceRows } = await admin
    .from("invoices")
    .select("id")
    .eq("user_id", testUser.userId);
  expect(invoiceRows).toHaveLength(1);

  // Reload — the sidebar reads recent invoices server-side, needs a server roundtrip.
  await page.reload();

  // Sidebar should now show at least one invoice with PL pill.
  const sidebarPL = page.locator("aside").getByText("PL").first();
  await expect(sidebarPL).toBeVisible();

  // Navigate to /app/history.
  await page.getByRole("link", { name: /Cały archiwum/i }).click();
  await expect(page).toHaveURL(/\/app\/history$/);
  await expect(page.getByRole("heading", { level: 1, name: /Historia faktur/i })).toBeVisible();

  // The uploaded invoice should appear as a row.
  await expect(page.getByText(/Brak faktur do wyświetlenia/i)).not.toBeVisible();
  // Row has an Open link.
  await expect(page.getByRole("link", { name: /Otwórz/i }).first()).toBeVisible();
});
