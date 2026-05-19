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
    const sourceInvoice = {
      ...invoice(),
      additionalDescriptions: [{ key: "Lokalizacja", value: "Usługa przygotowania dokumentacji" }]
    };

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
                additionalDescriptions: [{ key: "Lokalizacja", value: "Usługa przygotowania dokumentacji" }],
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
                additionalDescriptions: [{ key: "Standort", value: "Dienstleistung zur Erstellung von Dokumentation" }],
                settlementReasons: [],
                notes: "",
                footer: ""
              })
            }
          }
        ]
      });

    const { translateInvoiceFreeText } = await import("@/lib/translation/engine");
    const translated = await translateInvoiceFreeText(sourceInvoice, "de");

    expect(createMock).toHaveBeenCalledTimes(4);
    expect(translated.items[0].translatedName).toBe("Dienstleistung am Standort");
    expect(translated.additionalDescriptions?.[0].translatedKey).toBe("Standort");
    expect(translated.additionalDescriptions?.[0].translatedValue).toBe("Dienstleistung zur Erstellung von Dokumentation");
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
    expect(payloads[0].section).toBe("line_items");
    expect(payloads[0].fields.items).toEqual([sourceInvoice.items[0].name]);
    expect(payloads[0].fields.additionalDescriptions).toEqual([]);
    expect(payloads[1].section).toBe("invoice_annotations");
    expect(payloads[1].fields.items).toEqual([]);
    expect(payloads[1].fields.additionalDescriptions).toEqual([{ key: "Lokalizacja", value: "Warszawa" }]);
  });

  it("translates invoice annotation keys and values on the first pass", async () => {
    const sourceInvoice = {
      ...invoice(),
      additionalDescriptions: [
        {
          key: "Informacja o przedmiocie sprzedaży",
          value: "Świadczenie usług na rzecz podatnika VAT UE"
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
                    key: "Information about the subject of sale",
                    value: "Provision of services to an EU VAT taxpayer"
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
    const translated = await translateInvoiceFreeText(sourceInvoice, "en");

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(translated.additionalDescriptions?.[0].translatedKey).toBe("Information about the subject of sale");
    expect(translated.additionalDescriptions?.[0].translatedValue).toBe("Provision of services to an EU VAT taxpayer");

    const payloads = createMock.mock.calls.map((call) => JSON.parse(call[0].messages[1].content));
    expect(payloads[1]).toMatchObject({
      section: "invoice_annotations",
      sectionGuidance: expect.stringContaining("additionalDescriptions contains {key,value} pairs")
    });
  });

  it("repairs only the section that failed quality checks", async () => {
    const sourceInvoice = {
      ...invoice(),
      additionalDescriptions: [{ key: "Lokalizacja", value: "Usługa przygotowania dokumentacji" }]
    };

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
                additionalDescriptions: [{ key: "Lokalizacja", value: "Usługa przygotowania dokumentacji" }],
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
                additionalDescriptions: [{ key: "Standort", value: "Dienstleistung zur Erstellung von Dokumentation" }],
                settlementReasons: [],
                notes: "",
                footer: ""
              })
            }
          }
        ]
      });

    const { translateInvoiceFreeText } = await import("@/lib/translation/engine");
    const translated = await translateInvoiceFreeText(sourceInvoice, "de");

    expect(createMock).toHaveBeenCalledTimes(3);
    expect(translated.items[0].translatedName).toBe("Dienstleistung am Standort");
    expect(translated.additionalDescriptions?.[0].translatedKey).toBe("Standort");

    const payloads = createMock.mock.calls.map((call) => JSON.parse(call[0].messages[1].content));
    expect(payloads[2].fields.items).toEqual([]);
    expect(payloads[2].fields.additionalDescriptions).toEqual([{ key: "Lokalizacja", value: "Usługa przygotowania dokumentacji" }]);
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

  it("does not repair English legal clauses that are already translated", async () => {
    const legalClause =
      "Supply of services to an EU VAT-registered customer – reverse charge, VAT liability rests with the recipient, in accordance with Art. 44 and Art. 196 of Council Directive 2006/112/EC.";
    const legalInvoice = {
      ...invoice(),
      additionalDescriptions: [{ key: "Uwagi", value: legalClause }]
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
                additionalDescriptions: [{ key: "Notes", value: legalClause }],
                settlementReasons: [],
                notes: "",
                footer: ""
              })
            }
          }
        ]
      });

    const { translateInvoiceFreeText } = await import("@/lib/translation/engine");
    const translated = await translateInvoiceFreeText(legalInvoice, "en");

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(translated.additionalDescriptions?.[0].translatedValue).toBe(legalClause);
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
