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

interface SeedOptions {
  status?: "pending" | "paid" | "failed" | "refunded" | "expired";
  createdAt?: Date;
}

async function seedPurchase(
  userId: string,
  packageSize: number,
  { status = "paid", createdAt = new Date() }: SeedOptions = {}
) {
  await admin.from("stripe_purchases").insert({
    user_id: userId,
    stripe_checkout_session_id: `cs_${userId}_${Math.random().toString(36).slice(2)}`,
    package_size: packageSize,
    unit_price_cents: 599,
    total_amount_cents: 599 * packageSize,
    status,
    created_at: createdAt.toISOString()
  });
}

const TWO_HOURS_AGO = () => new Date(Date.now() - 2 * 60 * 60 * 1000);

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

  it("allows up to 2 recent paid purchases", async () => {
    const userId = await newUser("two");
    await seedPurchase(userId, 5);
    await seedPurchase(userId, 5);
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).resolves.toBeUndefined();
  });

  it("rejects with session_cap on the 3rd paid purchase in 24h", async () => {
    const userId = await newUser("session-cap");
    await seedPurchase(userId, 5);
    await seedPurchase(userId, 5);
    await seedPurchase(userId, 5);
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).rejects.toMatchObject({
      name: "AbuseCapError",
      reason: "session_cap"
    });
  });

  it("counts refunded purchases toward the session cap", async () => {
    // A refunded purchase was still a completed purchase in the window;
    // excluding it would let refund churn bypass the cap entirely.
    const userId = await newUser("refunded");
    await seedPurchase(userId, 5);
    await seedPurchase(userId, 5);
    await seedPurchase(userId, 5, { status: "refunded" });
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).rejects.toMatchObject({
      name: "AbuseCapError",
      reason: "session_cap"
    });
  });

  it("ignores abandoned and failed checkout sessions for the session cap", async () => {
    // Regression: opening the checkout page creates a 'pending' row before
    // any payment. Three abandoned checkouts must not lock a user out.
    const userId = await newUser("abandoned");
    await seedPurchase(userId, 5, { status: "pending", createdAt: TWO_HOURS_AGO() });
    await seedPurchase(userId, 15, { status: "pending", createdAt: TWO_HOURS_AGO() });
    await seedPurchase(userId, 10, { status: "pending", createdAt: TWO_HOURS_AGO() });
    await seedPurchase(userId, 5, { status: "failed" });
    await seedPurchase(userId, 5, { status: "expired" });
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).resolves.toBeUndefined();
  });

  it("rejects with credit_cap when paid credits in 24h would exceed 500", async () => {
    const userId = await newUser("credit-cap");
    await seedPurchase(userId, 100);
    await seedPurchase(userId, 100);
    // Paid total = 200; next session of 350 would push us over 500.
    await expect(
      assertWithinAbuseCaps({ supabase: admin, userId, requestedPackageSize: 350 })
    ).rejects.toMatchObject({ name: "AbuseCapError", reason: "credit_cap" });
  });

  it("ignores credits on non-paid sessions for the credit cap", async () => {
    const userId = await newUser("pending-credits");
    await seedPurchase(userId, 100);
    await seedPurchase(userId, 100);
    await seedPurchase(userId, 100, { status: "pending", createdAt: TWO_HOURS_AGO() });
    await seedPurchase(userId, 100, { status: "expired" });
    // Paid total = 200; requesting 250 keeps paid credits at 450 <= 500.
    await expect(
      assertWithinAbuseCaps({ supabase: admin, userId, requestedPackageSize: 250 })
    ).resolves.toBeUndefined();
  });

  it("rejects with pending_cap when too many sessions were opened within the hour", async () => {
    const userId = await newUser("pending-cap");
    for (let i = 0; i < 5; i++) {
      await seedPurchase(userId, 5, { status: "pending" });
    }
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).rejects.toMatchObject({
      name: "AbuseCapError",
      reason: "pending_cap"
    });
  });

  it("lets pending sessions age out of the one-hour spam window", async () => {
    const userId = await newUser("pending-aged");
    for (let i = 0; i < 5; i++) {
      await seedPurchase(userId, 5, { status: "pending", createdAt: TWO_HOURS_AGO() });
    }
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).resolves.toBeUndefined();
  });

  it("ignores purchases older than 24h", async () => {
    const userId = await newUser("old");
    const longAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await seedPurchase(userId, 100, { createdAt: longAgo });
    await seedPurchase(userId, 100, { createdAt: longAgo });
    await seedPurchase(userId, 100, { createdAt: longAgo });
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).resolves.toBeUndefined();
  });

  it("throws AbuseCapError instances (route relies on instanceof)", async () => {
    const userId = await newUser("instance");
    await seedPurchase(userId, 5);
    await seedPurchase(userId, 5);
    await seedPurchase(userId, 5);
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).rejects.toBeInstanceOf(
      AbuseCapError
    );
  });
});
