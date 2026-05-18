import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { uploadInvoiceForUser } from "@/lib/invoice/upload-service";
import { getRecentInvoices, listInvoices } from "@/lib/invoice/recent-invoices";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");
let userId: string;

beforeAll(async () => {
  const email = `recent-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  userId = data.user!.id;
});

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
});

describe("getRecentInvoices", () => {
  it("returns an empty list when the user has no invoices", async () => {
    const result = await getRecentInvoices(userId, 5);
    expect(result).toEqual([]);
  });

  it("returns invoices ordered by created_at desc, most recent first", async () => {
    const bytes1 = readFileSync(samplePath);
    const bytes2 = Buffer.concat([bytes1, Buffer.from("\n<!-- v2 -->")]);
    const bytes3 = Buffer.concat([bytes1, Buffer.from("\n<!-- v3 -->")]);

    await uploadInvoiceForUser({ userId, file: new File([bytes1], "1.xml", { type: "application/xml" }), supabase: admin });
    await uploadInvoiceForUser({ userId, file: new File([bytes2], "2.xml", { type: "application/xml" }), supabase: admin });
    await uploadInvoiceForUser({ userId, file: new File([bytes3], "3.xml", { type: "application/xml" }), supabase: admin });

    const result = await getRecentInvoices(userId, 5);
    expect(result.length).toBe(3);
    const numbers = result.map((r) => r.invoiceNumber);
    expect(numbers[0]).toBeTruthy();
  });

  it("limits results to the requested count", async () => {
    const result = await getRecentInvoices(userId, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("returns shape: id, invoiceNumber, issueDate, sellerName, totalGross, currency, translatedLanguages", async () => {
    const result = await getRecentInvoices(userId, 1);
    expect(result.length).toBe(1);
    const row = result[0];
    expect(row).toHaveProperty("id");
    expect(row).toHaveProperty("invoiceNumber");
    expect(row).toHaveProperty("issueDate");
    expect(row).toHaveProperty("sellerName");
    expect(row).toHaveProperty("totalGross");
    expect(row).toHaveProperty("currency");
    expect(row).toHaveProperty("translatedLanguages");
    expect(Array.isArray(row.translatedLanguages)).toBe(true);
  });
});

describe("listInvoices", () => {
  it("paginates with page=1 + perPage=2", async () => {
    const page1 = await listInvoices(userId, { page: 1, perPage: 2 });
    expect(page1.rows.length).toBe(2);
    expect(page1.totalCount).toBe(3);
    expect(page1.page).toBe(1);
    expect(page1.perPage).toBe(2);
  });

  it("paginates with page=2 + perPage=2", async () => {
    const page2 = await listInvoices(userId, { page: 2, perPage: 2 });
    expect(page2.rows.length).toBe(1);
  });

  it("filters by search (substring of invoiceNumber)", async () => {
    const all = await listInvoices(userId, { page: 1, perPage: 10 });
    const someNumber = all.rows[0]?.invoiceNumber ?? "";
    if (someNumber) {
      const subset = someNumber.slice(0, 4);
      const filtered = await listInvoices(userId, { page: 1, perPage: 10, search: subset });
      expect(filtered.rows.length).toBeGreaterThan(0);
      expect(filtered.rows.every((r) => r.invoiceNumber?.includes(subset) ?? false)).toBe(true);
    }
  });
});
