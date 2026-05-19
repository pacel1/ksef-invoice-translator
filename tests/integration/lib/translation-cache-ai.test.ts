import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/types/invoice";

const { translateMock } = vi.hoisted(() => ({
  translateMock: vi.fn()
}));

vi.mock("@/lib/translation/engine", () => ({
  getTranslationEngineVersion: () => "free-text-v1:gpt-4.1-mini",
  translateInvoiceFreeText: translateMock
}));

describe("getOrCreateTranslation with AI", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    translateMock.mockReset();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  it("uses the translations cache when AI is enabled", async () => {
    const source = invoice();
    const translated = { ...source, language: "de" };
    translateMock.mockResolvedValue(translated);
    const supabase = inMemorySupabase();

    const { getOrCreateTranslation } = await import("@/lib/translation/translation-cache");
    const first = await getOrCreateTranslation({
      supabase: supabase as never,
      invoice: source,
      invoiceId: "00000000-0000-0000-0000-000000000000",
      language: "de",
      bilingual: true
    });
    const second = await getOrCreateTranslation({
      supabase: supabase as never,
      invoice: source,
      invoiceId: "00000000-0000-0000-0000-000000000000",
      language: "de",
      bilingual: true
    });

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.invoice).toEqual(translated);
    expect(second.engineVersion).toBe("free-text-v1:gpt-4.1-mini");
    expect(translateMock).toHaveBeenCalledTimes(1);
    expect(supabase.insertedRows).toEqual([
      expect.not.objectContaining({ engine_version: expect.anything() })
    ]);
    expect(supabase.filters).not.toContain("engine_version");
  });

  it("reads the winner row after a concurrent insert conflict", async () => {
    const source = invoice();
    const translated = { ...source, language: "de" };
    translateMock.mockResolvedValue(translated);
    const supabase = inMemorySupabase({ failNextInsertWithDuplicate: true, existingOnDuplicate: translated });

    const { getOrCreateTranslation } = await import("@/lib/translation/translation-cache");
    const result = await getOrCreateTranslation({
      supabase: supabase as never,
      invoice: source,
      invoiceId: "00000000-0000-0000-0000-000000000001",
      language: "de",
      bilingual: true
    });

    expect(result.cached).toBe(true);
    expect(result.invoice).toEqual(translated);
    expect(result.timings.cacheRaceLookupMs).toEqual(expect.any(Number));
    expect(translateMock).toHaveBeenCalledTimes(1);
    expect(supabase.filters).not.toContain("engine_version");
  });
});

function inMemorySupabase(options: { failNextInsertWithDuplicate?: boolean; existingOnDuplicate?: Invoice } = {}) {
  const rows: Array<Record<string, unknown>> = [];
  const filtersSeen: string[] = [];
  let failNextInsertWithDuplicate = Boolean(options.failNextInsertWithDuplicate);

  return {
    insertedRows: rows,
    filters: filtersSeen,
    from: vi.fn(() => ({
      select: () => selectQuery(rows, filtersSeen),
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            if (failNextInsertWithDuplicate) {
              failNextInsertWithDuplicate = false;
              if (options.existingOnDuplicate) {
                rows.push({
                  ...row,
                  translated_data: options.existingOnDuplicate,
                  used_ai: true
                });
              }
              return { data: null, error: { code: "23505", message: "duplicate key" } };
            }
            rows.push(row);
            return { data: { id: "translation-id" }, error: null };
          }
        })
      })
    }))
  };
}

function selectQuery(rows: Array<Record<string, unknown>>, filtersSeen: string[]) {
  const filters: Record<string, unknown> = {};
  const query = {
    eq: (key: string, value: unknown) => {
      filtersSeen.push(key);
      filters[key] = value;
      return query;
    },
    maybeSingle: async () => {
      const row = rows.find((candidate) =>
        Object.entries(filters).every(([key, value]) => candidate[key] === value)
      );
      return { data: row ?? null, error: null };
    }
  };
  return query;
}

function invoice(): Invoice {
  return {
    invoiceNumber: "FV/1",
    issueDate: "2026-05-15",
    currency: "PLN",
    seller: { name: "Seller" },
    buyer: { name: "Buyer" },
    items: [],
    totals: { net: 0, vat: 0, gross: 0 }
  };
}
