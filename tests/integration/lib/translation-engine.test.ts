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
                additionalDescriptions: [],
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
                items: [],
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
                additionalDescriptions: [],
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
                items: [],
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

    expect(createMock).toHaveBeenCalledTimes(4);
    expect(translated.items[0].translatedName).toBe("Dienstleistung am Standort");
    expect(translated.additionalDescriptions?.[0].translatedKey).toBe("Standort");
    expect(translated.additionalDescriptions?.[0].translatedValue).toBe("Warschau");
  });

  it("translates item and note sections with parallel requests", async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: ["Service at the location"],
                orderLines: [],
                units: {},
                additionalDescriptions: [],
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
                items: [],
                orderLines: [],
                units: {},
                additionalDescriptions: [{ key: "Location", value: "Warsaw" }],
                settlementReasons: [],
                notes: "",
                footer: ""
              })
            }
          }
        ]
      });

    const sourceInvoice = invoice();
    const { translateInvoiceFreeText } = await import("@/lib/translation/engine");
    const translated = await translateInvoiceFreeText(sourceInvoice, "en");

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(translated.items[0].translatedName).toBe("Service at the location");
    expect(translated.additionalDescriptions?.[0].translatedKey).toBe("Location");
    expect(translated.additionalDescriptions?.[0].translatedValue).toBe("Warsaw");

    const payloads = createMock.mock.calls.map((call) => JSON.parse(call[0].messages[1].content));
    expect(payloads[0].fields.items).toEqual([sourceInvoice.items[0].name]);
    expect(payloads[0].fields.additionalDescriptions).toEqual([]);
    expect(payloads[1].fields.items).toEqual([]);
    expect(payloads[1].fields.additionalDescriptions).toEqual([{ key: "Lokalizacja", value: "Warszawa" }]);
  });

  it("repairs only the section that failed quality checks", async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: ["Dienstleistung am Standort"],
                orderLines: [],
                units: {},
                additionalDescriptions: [],
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
                items: [],
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
                items: [],
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

    expect(createMock).toHaveBeenCalledTimes(3);
    expect(translated.items[0].translatedName).toBe("Dienstleistung am Standort");
    expect(translated.additionalDescriptions?.[0].translatedKey).toBe("Standort");

    const payloads = createMock.mock.calls.map((call) => JSON.parse(call[0].messages[1].content));
    expect(payloads[2].fields.items).toEqual([]);
    expect(payloads[2].fields.additionalDescriptions).toEqual([{ key: "Lokalizacja", value: "Warszawa" }]);
  });

  it("uses local translations for common additional description keys before repair", async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: ["Service at the location"],
                orderLines: [],
                units: {},
                additionalDescriptions: [],
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
                items: [],
                orderLines: [],
                units: {},
                additionalDescriptions: [{ key: "Lokalizacja", value: "Warsaw" }],
                settlementReasons: [],
                notes: "",
                footer: ""
              })
            }
          }
        ]
      });

    const { translateInvoiceFreeText } = await import("@/lib/translation/engine");
    const translated = await translateInvoiceFreeText(invoice(), "en");

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(translated.additionalDescriptions?.[0].translatedKey).toBe("Location");
    expect(translated.additionalDescriptions?.[0].translatedValue).toBe("Warsaw");
  });

  it("does not repair protected business names and addresses", async () => {
    const addressInvoice = {
      ...invoice(),
      additionalDescriptions: [
        {
          key: "Lokalizacja",
          value: "ZOOART MAREK POSTRZECH ; WYSPA WISŁA ; UL. MOSZCZANKA 56A ; RYKI ; 08-500"
        }
      ]
    };

    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: ["Service at the location"],
                orderLines: [],
                units: {},
                additionalDescriptions: [],
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
                items: [],
                orderLines: [],
                units: {},
                additionalDescriptions: [
                  {
                    key: "Location",
                    value: "ZOOART MAREK POSTRZECH ; WYSPA WISŁA ; UL. MOSZCZANKA 56A ; RYKI ; 08-500"
                  }
                ],
                settlementReasons: [],
                notes: "",
                footer: ""
              })
            }
          }
        ]
      });

    const { translateInvoiceFreeText } = await import("@/lib/translation/engine");
    const translated = await translateInvoiceFreeText(addressInvoice, "en");

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(translated.additionalDescriptions?.[0].translatedValue).toBe(addressInvoice.additionalDescriptions[0].value);
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
