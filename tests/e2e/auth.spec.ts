import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

async function generateMagicLink(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email
  });
  if (error || !data.properties?.action_link) {
    throw new Error(`Failed to generate magic link: ${error?.message ?? "no action_link"}`);
  }
  return data.properties.action_link;
}

test("sign in via magic link lands on /app", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;

  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/Wysłaliśmy link logowania/i)).toBeVisible();

  // The form submission above triggers a real magic-link email — but rather than
  // intercept SMTP we exchange the link admin-side. The user appears in auth.users
  // either way, so the admin-generated link resolves to the same session.
  const link = await generateMagicLink(email);
  await page.goto(link);

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
