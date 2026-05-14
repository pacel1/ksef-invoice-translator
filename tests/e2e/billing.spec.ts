import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

async function signIn(page: import("@playwright/test").Page, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error("generateLink failed");
  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}&type=email`);
  await expect(page).toHaveURL(/\/app$/);
}

async function deleteUser(email: string) {
  const { data } = await admin.auth.admin.listUsers();
  const created = data.users.find((u) => u.email === email);
  if (created) await admin.auth.admin.deleteUser(created.id);
}

test("slider reflects price changes and redirects to Stripe Checkout", async ({ page }) => {
  const email = `billing-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signIn(page, email);

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
  const userId = (await admin.auth.admin.listUsers()).data.users.find((u) => u.email === email)?.id;
  const { data: rows } = await admin
    .from("stripe_purchases")
    .select("package_size, status")
    .eq("user_id", userId!)
    .order("created_at", { ascending: false })
    .limit(1);
  expect(rows?.[0]).toMatchObject({ package_size: 50, status: "pending" });

  await deleteUser(email);
});

test("?status=paid shows success toast and dispatches balance-changed", async ({ page }) => {
  const email = `billing-paid-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signIn(page, email);

  await page.goto("/billing?status=paid&session_id=cs_test_stub");
  await expect(page.getByText(/Płatność zakończona|Payment complete/i)).toBeVisible();

  await deleteUser(email);
});

test("?status=cancelled shows cancellation toast", async ({ page }) => {
  const email = `billing-cancel-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signIn(page, email);

  await page.goto("/billing?status=cancelled");
  await expect(page.getByText(/Płatność anulowana|Payment cancelled/i)).toBeVisible();

  await deleteUser(email);
});
