import { test as base, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Service-role Supabase client shared across all E2E specs. Persists no
 * session — every call is an admin operation.
 */
export const admin: SupabaseClient = createClient(url, serviceRole, {
  auth: { persistSession: false }
});

export interface TestUser {
  /** The freshly-created test user's email address. */
  email: string;
  /** The user's id, returned directly by createUser — no listUsers paging. */
  userId: string;
}

/**
 * Generates a magic link for `email` (admin API), navigates the browser to
 * `/auth/callback?token_hash=...`, and asserts the user lands on `/app`.
 *
 * This exercises the full callback → verifyOtp → middleware path the way a
 * real magic-link click would, without depending on the user receiving an
 * actual email.
 */
export async function signIn(page: Page, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email
  });
  if (error || !data.properties?.hashed_token) {
    throw new Error(
      `generateLink failed for ${email}: ${error?.message ?? "no hashed_token"}`
    );
  }
  await page.goto(
    `/auth/callback?token_hash=${data.properties.hashed_token}&type=email`
  );
  await expect(page).toHaveURL(/\/app$/);
}

/**
 * Slug-ify a test title for use in a unique test email. Strips non-alphanum,
 * lowercases, and caps to 40 chars so the email stays under reasonable
 * length limits.
 */
function slugifyTitle(title: string): string {
  return title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40);
}

/**
 * Playwright fixture extending `base` with a `testUser` lifecycle.
 *
 * Each test gets a freshly-created user (unique email + real auth row) and
 * the cleanup runs in a `finally` block so the user is deleted EVEN IF the
 * test body throws. This prevents test-user leaks that previously caused
 * `listUsers()` pagination misses once the project grew past 50 users.
 *
 * The user's id comes from the `createUser` response — callers should use
 * `testUser.userId` directly instead of looking it up via `listUsers().find()`.
 *
 * Usage:
 *
 *   import { test, expect, admin, signIn } from "./helpers/auth";
 *
 *   test("does a thing", async ({ page, testUser }) => {
 *     await signIn(page, testUser.email);
 *     await admin.from("invoices").select("id").eq("user_id", testUser.userId);
 *   });
 */
export const test = base.extend<{ testUser: TestUser }>({
  testUser: async ({}, use, testInfo) => {
    const slug = slugifyTitle(testInfo.title) || "untitled";
    const email = `e2e-${slug}-${Date.now()}@example.test`;
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true
    });
    if (created.error || !created.data.user) {
      throw new Error(
        `createUser failed for ${email}: ${created.error?.message ?? "no user"}`
      );
    }
    const userId = created.data.user.id;
    try {
      await use({ email, userId });
    } finally {
      // Cleanup runs even if the test body threw. Swallow + log any cleanup
      // error so a delete-failure doesn't mask the original test failure.
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch (err) {
        console.warn(`[e2e cleanup] failed to delete ${email} (${userId}):`, err);
      }
    }
  }
});

export { expect };
