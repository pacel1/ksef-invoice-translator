import path from "node:path";
import { admin, expect, signIn, test } from "./helpers/auth";

/**
 * E2E happy paths for the Tłumacz wizard (spec §10). Post-cutover (PR #E)
 * the flag is gone and /translate is the canonical authoring surface.
 */

const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

test.describe("Tłumacz wizard — happy paths", () => {
  test("Step 1 → Step 2 → Step 3 single-file flow", async ({ page, testUser }) => {
    await signIn(page, testUser.email);
    await page.goto("/translate");

    // Step 1: see hero drop zone with the upload heading.
    await expect(
      page.getByRole("heading", { name: /Wybierz pliki KSeF do tłumaczenia/i })
    ).toBeVisible();

    // Drop a single sample file.
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByText(/Przeciągnij pliki lub wybierz z dysku/i).click();
    const chooser = await chooserPromise;
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/upload-batch") && r.request().method() === "POST"
      ),
      chooser.setFiles(samplePath)
    ]);

    // File row should appear in 'ready' state.
    await expect(page.getByText(/sample-fa3-invoice\.xml/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Dalej/i })
    ).toBeEnabled();

    // Step 2: navigate, pick German, leave mono.
    await page.getByRole("button", { name: /Dalej/i }).click();
    await expect(
      page.getByRole("heading", { name: /Wybierz język i format/i })
    ).toBeVisible();

    // Cost preview should show 1 credit.
    await expect(page.getByText(/Koszt/i)).toBeVisible();
    await expect(page.getByText(/^1 kredyt$/)).toBeVisible();

    await page.getByRole("button", { name: /^DE/ }).click();

    // Step 3: trigger translate.
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/translate") && r.request().method() === "POST",
        { timeout: 60_000 }
      ),
      page.getByRole("button", { name: /Tłumacz/i }).click()
    ]);

    // Delivery view appears with the single-file shape.
    await expect(page.getByTestId("delivery-single")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Pobierz PDF/i })
    ).toBeVisible();
  });

  test("low-credit user is steered to /billing in Step 2", async ({
    page,
    testUser
  }) => {
    // Drain the user's credits before signing in so Step 2 reflects 0.
    await admin
      .from("credit_balances")
      .upsert({
        user_id: testUser.userId,
        free_credits_remaining: 0,
        paid_credits: 0
      });

    await signIn(page, testUser.email);
    await page.goto("/translate");

    // Upload one file.
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByText(/Przeciągnij pliki lub wybierz z dysku/i).click();
    const chooser = await chooserPromise;
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/upload-batch") && r.request().method() === "POST"
      ),
      chooser.setFiles(samplePath)
    ]);

    // Advance to Step 2.
    await page.getByRole("button", { name: /Dalej/i }).click();
    await page.getByRole("button", { name: /^EN/ }).click();

    // The 'Tłumacz' CTA should be replaced by a Doładuj kredyty link.
    await expect(
      page.getByRole("link", { name: /Doładuj kredyty/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Doładuj kredyty/i })
    ).toHaveAttribute("href", /\/billing\?return=.*&pending=1/);
  });

  test("the Polish-friendly /tlumaczenie alias 308-redirects to /translate", async ({
    page,
    testUser
  }) => {
    await signIn(page, testUser.email);
    await page.goto("/tlumaczenie");
    await expect(page).toHaveURL(/\/translate$/);
  });
});
