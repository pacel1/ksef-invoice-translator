import { test as base } from "@playwright/test";
import { admin, expect, test } from "./helpers/auth";

async function generateTokenHash(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email
  });
  if (error || !data.properties?.hashed_token) {
    throw new Error(`Failed to generate magic link: ${error?.message ?? "no hashed_token"}`);
  }
  return data.properties.hashed_token;
}

test("sign in via magic link lands on /app", async ({ page, testUser }) => {
  // Intercept the Supabase OTP request so the form sees a success response
  // without requiring a resolvable email domain on the remote project.
  await page.route(/\/auth\/v1\/otp/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({})
    });
  });

  await page.goto("/login");
  await page.fill('input[type="email"]', testUser.email);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/Wysłaliśmy link logowania/i)).toBeVisible();

  // Generate the token hash admin-side and navigate to /auth/callback with it.
  // The callback route calls verifyOtp(token_hash) server-side, which sets the
  // session cookie and redirects to /app — exercising the full auth middleware.
  const tokenHash = await generateTokenHash(testUser.email);
  await page.goto(`/auth/callback?token_hash=${tokenHash}&type=email`);

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(testUser.email)).toBeVisible();
});

// This test doesn't need a fixture user — use the base test import so the
// testUser fixture is never instantiated.
base("logged-out visit to /app redirects to /login", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
});
