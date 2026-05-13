import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

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

test("sign in via magic link lands on /app", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;

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
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/Wysłaliśmy link logowania/i)).toBeVisible();

  // Generate the token hash admin-side and navigate to /auth/callback with it.
  // The callback route calls verifyOtp(token_hash) server-side, which sets the
  // session cookie and redirects to /app — exercising the full auth middleware.
  const tokenHash = await generateTokenHash(email);
  await page.goto(`/auth/callback?token_hash=${tokenHash}&type=email`);

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(email)).toBeVisible();

  // Cleanup
  const { data } = await admin.auth.admin.listUsers();
  const created = data.users.find((u) => u.email === email);
  if (created) await admin.auth.admin.deleteUser(created.id);
});

test("logged-out visit to /app redirects to /login", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
});
