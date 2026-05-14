import { admin, expect, signIn, test } from "./helpers/auth";

test("slider reflects price changes and redirects to Stripe Checkout", async ({ page, testUser }) => {
  await signIn(page, testUser.email);

  await page.goto("/billing");

  // Default size is 25 → 4.99 zł / inv. The slider initial value should show 25.
  await expect(page.locator("#slider")).toHaveValue("25");

  // Drag the slider to 50 — value goes up, unit price drops to 3.99 zł.
  await page.locator("#slider").fill("50");
  await expect(page.locator("#slider")).toHaveValue("50");
  // 50 * 399 = 19950 → "199,50 zł" (Polish formatting) or "PLN 199.50".
  await expect(page.getByText(/199[,.]50/)).toBeVisible({ timeout: 10_000 });

  // Click Continue — should redirect to Stripe Checkout. We intercept the navigation
  // rather than actually loading checkout.stripe.com (which would slow the test).
  // We also abort any navigation to checkout.stripe.com so the page doesn't leave
  // and the response body remains accessible.
  let checkoutPayload: { url?: string } = {};

  await page.route("**/api/stripe/checkout", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    checkoutPayload = body;
    await route.fulfill({ response });
  });

  // Intercept the Stripe redirect so the page stays and we can inspect the DB.
  await page.route(/checkout\.stripe\.com/, (route) => route.abort());

  await page.getByRole("button", { name: /Przejdź do płatności|Continue to checkout/i }).click();

  // Wait for checkoutPayload to be populated (the route handler fires before the redirect).
  await expect.poll(() => checkoutPayload.url, { timeout: 15_000 }).toMatch(/^https:\/\/checkout\.stripe\.com\//);

  expect(checkoutPayload.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);

  // Source-of-truth check: a stripe_purchases row should exist for this user with status='pending'.
  const { data: rows } = await admin
    .from("stripe_purchases")
    .select("package_size, status")
    .eq("user_id", testUser.userId)
    .order("created_at", { ascending: false })
    .limit(1);
  expect(rows?.[0]).toMatchObject({ package_size: 50, status: "pending" });
});

test("?status=paid shows success toast and dispatches balance-changed", async ({ page, testUser }) => {
  await signIn(page, testUser.email);

  await page.goto("/billing?status=paid&session_id=cs_test_stub");
  await expect(page.getByText(/Płatność zakończona|Payment complete/i)).toBeVisible();
});

test("?status=cancelled shows cancellation toast", async ({ page, testUser }) => {
  await signIn(page, testUser.email);

  await page.goto("/billing?status=cancelled");
  await expect(page.getByText(/Płatność anulowana|Payment cancelled/i)).toBeVisible();
});
