import path from "node:path";
import { admin, expect, signIn, test } from "./helpers/auth";

const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

test("authenticated user can upload, translate, and download an invoice", async ({ page, testUser }) => {
  await signIn(page, testUser.email);

  // Trigger the upload and wait for the network response — deterministic, no text-match races.
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await fileChooserPromise;
  const [uploadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST", { timeout: 30_000 }),
    chooser.setFiles(samplePath)
  ]);
  expect(uploadResponse.status()).toBe(200);

  // Source-of-truth check: the row should exist FOR THIS user (scoped, not "the 5 newest").
  const { data: invoiceRows } = await admin
    .from("invoices")
    .select("id, source_type")
    .eq("user_id", testUser.userId);
  expect(invoiceRows).toHaveLength(1);
  expect(invoiceRows![0].source_type).toBe("xml");

  // The workspace defaults to PL (original) — no auto-translate on upload.
  // Click the EN pill to trigger a translation, then wait for the response.
  const [translateResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/translate") && r.request().method() === "POST",
      { timeout: 30_000 }
    ),
    page.getByRole("button", { name: /^EN/ }).click()
  ]);
  expect(translateResponse.status()).toBe(200);

  // Download PDF — assert the network response.
  const [downloadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/pdf") && r.request().method() === "POST", { timeout: 60_000 }),
    page.getByRole("button", { name: /Pobierz PDF|Download PDF/i }).click()
  ]);
  expect(downloadResponse.status()).toBe(200);
  expect(downloadResponse.headers()["content-type"]).toContain("application/pdf");
});
