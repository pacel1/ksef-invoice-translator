import { describe, it, expect, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { AbuseCapError, assertWithinAbuseCaps } from "@/lib/billing/abuse-caps";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const createdUserIds: string[] = [];

async function newUser(label: string) {
  const email = `caps-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  const id = data.user!.id;
  createdUserIds.push(id);
  return id;
}

async function seedPurchase(userId: string, packageSize: number, createdAt: Date = new Date()) {
  await admin.from("stripe_purchases").insert({
    user_id: userId,
    stripe_checkout_session_id: `cs_${userId}_${Math.random().toString(36).slice(2)}`,
    package_size: packageSize,
    unit_price_cents: 599,
    total_amount_cents: 599 * packageSize,
    status: "paid",
    created_at: createdAt.toISOString()
  });
}

afterEach(async () => {
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()!;
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe("assertWithinAbuseCaps", () => {
  it("allows when the user has no recent purchases", async () => {
    const userId = await newUser("clean");
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).resolves.toBeUndefined();
  });

  it("allows up to 2 recent purchases", async () => {
    const userId = await newUser("two");
    await seedPurchase(userId, 5);
    await seedPurchase(userId, 5);
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).resolves.toBeUndefined();
  });

  it("rejects with session_cap on the 3rd attempt in 24h", async () => {
    const userId = await newUser("session-cap");
    await seedPurchase(userId, 5);
    await seedPurchase(userId, 5);
    await seedPurchase(userId, 5);
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).rejects.toBeInstanceOf(AbuseCapError);
  });

  it("rejects with credit_cap when total in 24h would exceed 500", async () => {
    const userId = await newUser("credit-cap");
    await seedPurchase(userId, 100);
    await seedPurchase(userId, 100);
    // Total = 200; next session of 350 would push us over 500.
    await expect(
      assertWithinAbuseCaps({ supabase: admin, userId, requestedPackageSize: 350 })
    ).rejects.toBeInstanceOf(AbuseCapError);
  });

  it("ignores purchases older than 24h", async () => {
    const userId = await newUser("old");
    const longAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await seedPurchase(userId, 100, longAgo);
    await seedPurchase(userId, 100, longAgo);
    await seedPurchase(userId, 100, longAgo);
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).resolves.toBeUndefined();
  });
});
