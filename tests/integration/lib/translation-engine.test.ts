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

  it("translates item and note sections with atomic task payloads", async () => {
    createMock
      .mockResolvedValueOnce(mockCompletion([{ id: "items.0", translated: "Service at the location" }]))
      .mockResolvedValueOnce(mockCompletion([
        { id: "additionalDescriptions.0.key", translated: "Location" },
        { id: "additionalDescriptions.0.value", translated: "Warsaw" }
      ]));

    const sourceInvoice = invoice();
    const { translateInvoiceFreeText } = await import("@/lib/translation/engine");
    const translated = await translateInvoiceFreeText(sourceInvoice, "en");

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(translated.items[0].translatedName).toBe("Service at the location");
    expect(translated.additionalDescriptions?.[0].translatedKey).toBe("Location");
    expect(translated.additionalDescriptions?.[0].translatedValue).toBe("Warsaw");

    const payloads = createMock.mock.calls.map((call) => JSON.parse(call[0].messages[1].content));
    expect(payloads[0]).toMatchObject({
      section: "line_items",
      tasks: [expect.objectContaining({ id: "items.0", kind: "line_item", source: sourceInvoice.items[0].name })]
    });
    expect(payloads[1]).toMatchObject({
      section: "invoice_annotations",
      sectionGuidance: expect.stringContaining("additionalDescriptions contains {key,value} pairs"),
      tasks: [
        expect.objectContaining({ id: "additionalDescriptions.0.key", kind: "annotation_key", source: "Lokalizacja" }),
        expect.objectContaining({ id: "additionalDescriptions.0.value", kind: "annotation_value", source: "Warszawa" })
      ]
    });
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
      .mockResolvedValueOnce(mockCompletion([{ id: "items.0", translated: "Service at the location" }]))
      .mockResolvedValueOnce(mockCompletion([
        { id: "additionalDescriptions.0.key", translated: "Information about the subject of sale" },
        { id: "additionalDescriptions.0.value", translated: "Provision of services to an EU VAT taxpayer" }
      ]));

    const { translateInvoiceFreeText } = await import("@/lib/translation/engine");
    const translated = await translateInvoiceFreeText(sourceInvoice, "en");

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(translated.additionalDescriptions?.[0].translatedKey).toBe("Information about the subject of sale");
    expect(translated.additionalDescriptions?.[0].translatedValue).toBe("Provision of services to an EU VAT taxpayer");
  });

  it("repairs only the failed atomic annotation task", async () => {
    const descriptions = Array.from({ length: 5 }, (_, index) => ({
      key: `Opis ${index + 1}`,
      value: index === 4 ? "Świadczenie usług na rzecz podatnika VAT UE" : `Value ${index + 1}`
    }));
    const sourceInvoice = { ...invoice(), additionalDescriptions: descriptions };

    createMock
      .mockResolvedValueOnce(mockCompletion([{ id: "items.0", translated: "Service at the location" }]))
      .mockResolvedValueOnce(mockCompletion([
        ...descriptions.flatMap((entry, index) => [
          { id: `additionalDescriptions.${index}.key`, translated: `Description ${index + 1}` },
          { id: `additionalDescriptions.${index}.value`, translated: entry.value }
        ])
      ]))
      .mockResolvedValueOnce(mockCompletion([
        { id: "additionalDescriptions.4.value", translated: "Provision of services to an EU VAT taxpayer" }
      ]));

    const { translateInvoiceFreeText } = await import("@/lib/translation/engine");
    const translated = await translateInvoiceFreeText(sourceInvoice, "en");

    expect(createMock).toHaveBeenCalledTimes(3);
    expect(translated.additionalDescriptions?.[4].translatedValue).toBe("Provision of services to an EU VAT taxpayer");

    const repairPayload = JSON.parse(createMock.mock.calls[2][0].messages[1].content);
    expect(repairPayload.section).toBe("invoice_annotations");
    expect(repairPayload.tasks).toEqual([
      expect.objectContaining({
        id: "additionalDescriptions.4.value",
        kind: "annotation_value",
        source: "Świadczenie usług na rzecz podatnika VAT UE"
      })
    ]);
  });

  it("repairs real untranslated Polish free-text", async () => {
    createMock
      .mockResolvedValueOnce(mockCompletion([{ id: "items.0", translated: "Usługa Lokalizacja" }]))
      .mockResolvedValueOnce(mockCompletion([
        { id: "additionalDescriptions.0.key", translated: "Location" },
        { id: "additionalDescriptions.0.value", translated: "Warsaw" }
      ]))
      .mockResolvedValueOnce(mockCompletion([{ id: "items.0", translated: "Service at the location" }]));

    const { translateInvoiceFreeText } = await import("@/lib/translation/engine");
    const translated = await translateInvoiceFreeText(invoice(), "en");

    expect(createMock).toHaveBeenCalledTimes(3);
    expect(translated.items[0].translatedName).toBe("Service at the location");
  });

  it("does not repair protected business names and addresses", async () => {
    const value = "ZOOART MAREK POSTRZECH ; WYSPA WISŁA ; UL. MOSZCZANKA 56A ; RYKI ; 08-500";
    const addressInvoice = {
      ...invoice(),
      additionalDescriptions: [{ key: "Lokalizacja", value }]
    };

    createMock
      .mockResolvedValueOnce(mockCompletion([{ id: "items.0", translated: "Service at the location" }]))
      .mockResolvedValueOnce(mockCompletion([
        { id: "additionalDescriptions.0.key", translated: "Location" },
        { id: "additionalDescriptions.0.value", translated: value }
      ]));

    const { translateInvoiceFreeText } = await import("@/lib/translation/engine");
    const translated = await translateInvoiceFreeText(addressInvoice, "en");

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(translated.additionalDescriptions?.[0].translatedValue).toBe(value);
  });

  it("does not repair English legal clauses that are already translated", async () => {
    const legalClause =
      "Supply of services to an EU VAT-registered customer - reverse charge, VAT liability rests with the recipient, in accordance with Art. 44 and Art. 196 of Council Directive 2006/112/EC.";
    const legalInvoice = {
      ...invoice(),
      additionalDescriptions: [{ key: "Uwagi", value: legalClause }]
    };

    createMock
      .mockResolvedValueOnce(mockCompletion([{ id: "items.0", translated: "Service at the location" }]))
      .mockResolvedValueOnce(mockCompletion([
        { id: "additionalDescriptions.0.key", translated: "Notes" },
        { id: "additionalDescriptions.0.value", translated: legalClause }
      ]));

    const { translateInvoiceFreeText } = await import("@/lib/translation/engine");
    const translated = await translateInvoiceFreeText(legalInvoice, "en");

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(translated.additionalDescriptions?.[0].translatedValue).toBe(legalClause);
  });
});

function mockCompletion(translations: { id: string; translated: string }[]) {
  return {
    choices: [
      {
        finish_reason: "stop",
        message: {
          content: JSON.stringify({ translations })
        }
      }
    ],
    usage: { completion_tokens: 20 }
  };
}

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
