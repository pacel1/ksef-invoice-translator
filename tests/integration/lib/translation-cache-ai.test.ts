import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/types/invoice";

const { translateMock } = vi.hoisted(() => ({
  translateMock: vi.fn()
}));

vi.mock("@/lib/translation/engine", () => ({
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

  it("does not read or write the translations cache when AI is enabled", async () => {
    const source = invoice();
    const translated = { ...source, language: "de" };
    translateMock.mockResolvedValue(translated);
    const supabase = {
      from: vi.fn(() => {
        throw new Error("cache should not be used when AI is enabled");
      })
    };

    const { getOrCreateTranslation } = await import("@/lib/translation/translation-cache");
    const result = await getOrCreateTranslation({
      supabase: supabase as never,
      invoice: source,
      invoiceId: "00000000-0000-0000-0000-000000000000",
      language: "de",
      bilingual: true
    });

    expect(result).toEqual({ invoice: translated, cached: false, usedAi: true });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(translateMock).toHaveBeenCalledWith(source, "de");
  });
});

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
