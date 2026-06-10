import { test, expect } from "@playwright/test";

test("landing rebuild preview renders chrome with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");

  await expect(page.getByText("TłumaczKSeF").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Wgraj pierwszą fakturę/i })).toBeVisible();
  await expect(page.getByText(/Dane w UE \(Frankfurt\)/i)).toBeVisible();
  // primary nav CTA points to /login
  await expect(page.getByRole("link", { name: "Zacznij za darmo" }).first()).toHaveAttribute("href", "/login");

  expect(errors).toEqual([]);
});

test("landing rebuild preview has no horizontal overflow at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(overflow).toBe(false);
});

test("mobile nav sheet paints above the page (no stacking bleed-through)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
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

test("hero renders with the level-1 headline and a CTA to the demo anchor", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Znowu przepisujesz fakturę");
  await expect(
    page.locator("#hero").getByRole("link", { name: "Przetłumacz swoją fakturę" })
  ).toHaveAttribute("href", "#demo");
  // the animated showcase renders its invoice card (Polish title visible first)
  await expect(page.getByText("FAKTURA").first()).toBeVisible();
});

test("renders the four explainer sections in order", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Wysyłasz polski PDF.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Trzy kroki/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Zostaje bez zmian" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Prowadzisz biuro rachunkowe" })).toBeVisible();
});

test("renders pricing + faq sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: /Płacisz tylko za faktury/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Zobacz pełny cennik" })).toHaveAttribute("href", "/pricing");
  await expect(page.getByRole("heading", { level: 2, name: /Najczęstsze pytania/ })).toBeVisible();
  await expect(page.getByText("Co z kodem QR?")).toBeVisible();
});

test("demo section reveals the sample and switches language on chip click", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 2, name: "Zobacz swoją fakturę w innym języku" })
  ).toBeVisible();
  const demo = page.locator("#demo");
  // default English rendering
  await expect(demo.getByText('Oak chair „Helena”')).toBeVisible();
  // switch to German
  await demo.getByRole("button", { name: "DE", exact: true }).click();
  await expect(demo.getByText('Eichenstuhl „Helena”')).toBeVisible();
  // the primary CTA opens the email gate
  await demo.getByRole("button", { name: "Pobierz PDF" }).click();
  await expect(demo.getByLabel("Adres e-mail")).toBeVisible();
});

test("demo upload lane renders an uploaded invoice through the mocked translate API", async ({ page }) => {
  const uploadedInvoice = {
    invoiceNumber: "FV 2026/06/0007",
    invoiceType: "VAT",
    issueDate: "2026-06-01",
    saleDate: "2026-06-01",
    currency: "EUR",
    seller: { name: "Tartak Modrzew Sp. z o.o.", vatId: "5252389632", address: "ul. Leśna 2, 10-100 Olsztyn, PL" },
    buyer: { name: "Nordholz GmbH", vatId: "DE129273398", address: "Holzweg 8, 20095 Hamburg, DE" },
    items: [
      {
        name: "Deska tarasowa modrzewiowa",
        translatedName: "Larch decking board",
        quantity: 100,
        unit: "szt",
        translatedUnit: "pcs",
        unitPrice: 18,
        netValue: 1800,
        vatRate: "0",
        grossValue: 1800
      }
    ],
    totals: { net: 1800, vat: 0, gross: 1800 }
  };
  await page.route("**/api/demo/translate", (route) =>
    route.fulfill({ json: { invoice: uploadedInvoice, sourceXml: "<Faktura/>", uploadToken: "e2e-token" } })
  );
  await page.goto("/");
  const demo = page.locator("#demo");
  await demo.getByRole("button", { name: "albo wgraj własną fakturę" }).click();
  await demo
    .locator('input[type="file"]')
    .setInputFiles({ name: "faktura.xml", mimeType: "application/xml", buffer: Buffer.from("<Faktura/>") });
  await expect(demo.getByText("Larch decking board")).toBeVisible();
  await expect(demo.getByText('Oak chair „Helena”')).not.toBeVisible();
});

test("english landing renders at /en with the live demo", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Still retyping your KSeF invoice");
  await expect(
    page.locator("#demo").getByRole("heading", { level: 2, name: "See your invoice in another language" })
  ).toBeVisible();
});

test("the live landing is indexable (no noindex robots meta)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
});
