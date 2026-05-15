import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/types/invoice";

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn()
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: createMock
      }
    }
  }))
}));

describe("translateInvoiceFreeText", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    createMock.mockReset();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  it("retries when AI leaves Polish free-text in non-English translations", async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: ["Dienstleistung Lokalizacja"],
                orderLines: [],
                units: {},
                additionalDescriptions: [{ key: "Lokalizacja", value: "Warszawa" }],
                settlementReasons: [],
                notes: "",
                footer: ""
              })
            }
          }
        ]
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: ["Dienstleistung am Standort"],
                orderLines: [],
                units: {},
                additionalDescriptions: [{ key: "Standort", value: "Warschau" }],
                settlementReasons: [],
                notes: "",
                footer: ""
              })
            }
          }
        ]
      });

    const { translateInvoiceFreeText } = await import("@/lib/translation/engine");
    const translated = await translateInvoiceFreeText(invoice(), "de");

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(translated.items[0].translatedName).toBe("Dienstleistung am Standort");
    expect(translated.additionalDescriptions?.[0].translatedKey).toBe("Standort");
    expect(translated.additionalDescriptions?.[0].translatedValue).toBe("Warschau");
  });
});

function invoice(): Invoice {
  return {
    invoiceNumber: "FV/1",
    issueDate: "2026-05-15",
    currency: "PLN",
    seller: { name: "Sprzedawca" },
    buyer: { name: "Nabywca" },
    items: [
      {
        name: "Usługa Lokalizacja",
        quantity: 1,
        unitPrice: 100,
        netValue: 100,
        vatRate: "23",
        grossValue: 123
      }
    ],
    totals: { net: 100, vat: 23, gross: 123 },
    additionalDescriptions: [{ key: "Lokalizacja", value: "Warszawa" }]
  };
}
