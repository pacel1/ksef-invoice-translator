import OpenAI from "openai";
import type { Invoice, LanguageCode, TranslatedInvoice } from "@/types/invoice";
import { translationTargets } from "@/lib/translation/languages";

export async function translateInvoiceFreeText(
  invoice: Invoice,
  language: LanguageCode
): Promise<TranslatedInvoice> {
  const targetLanguage = translationTargets[language];
  const orderLines = invoice.orders?.flatMap((order) => order.lines ?? []) ?? [];
  const units = Array.from(
    new Set([...invoice.items.map((item) => item.unit), ...orderLines.map((line) => line.unit)].filter(Boolean))
  ) as string[];
  const fields = {
    items: invoice.items.map((item) => item.name),
    orderLines: orderLines.map((line) => line.name ?? ""),
    units,
    additionalDescriptions: invoice.additionalDescriptions?.map((entry) => ({
      key: entry.key ?? "",
      value: entry.value
    })) ?? [],
    settlementReasons: [
      ...(invoice.settlements?.charges ?? []).map((line) => line.reason ?? ""),
      ...(invoice.settlements?.deductions ?? []).map((line) => line.reason ?? "")
    ],
    notes: invoice.notes ?? "",
    footer: invoice.footer?.text ?? ""
  };

  if (!process.env.OPENAI_API_KEY) {
    return {
      ...invoice,
      language,
      items: invoice.items.map((item) => ({
        ...item,
        translatedName: item.name,
        translatedUnit: item.unit
      })),
      additionalDescriptions: invoice.additionalDescriptions,
      settlements: invoice.settlements,
      orders: invoice.orders,
      translatedNotes: invoice.notes,
      footer: invoice.footer
        ? {
            ...invoice.footer,
            translatedText: invoice.footer.text
          }
        : undefined
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4.1-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Translate only invoice free text and units of measure into the requested target language. For additionalDescriptions.key, translate short category/type labels such as 'Lokalizacja' to the target language. For additionalDescriptions.value and footer, translate natural-language words and sentences, but preserve invoice numbers, dates, currencies, tax rates, amounts, VAT IDs, registration numbers, IBAN, SWIFT, bank account numbers, company names, product codes, registry numbers, street names, addresses, postal codes, and city names exactly as written. Do not leave Polish free-text labels unchanged when they have a normal target-language equivalent. Preserve the order and array lengths exactly. Return strict JSON with keys items:string[], orderLines:string[], units:object, additionalDescriptions:{key:string,value:string}[], settlementReasons:string[], notes:string, and footer:string. The units object must map each original unit string exactly to its translation."
      },
      {
        role: "user",
        content: JSON.stringify({ sourceLanguage: "Polish", targetLanguage, targetLanguageCode: language, fields })
      }
    ]
  });

  const content = completion.choices[0]?.message.content ?? "{}";
  const translated = safeJson(content) as {
    items?: string[];
    orderLines?: string[];
    units?: Record<string, string>;
    additionalDescriptions?: { key?: string; value?: string }[];
    settlementReasons?: string[];
    notes?: string;
    footer?: string;
  };
  let settlementIndex = 0;
  return {
    ...invoice,
    language,
    items: invoice.items.map((item, index) => ({
      ...item,
      translatedName: textAt(translated.items, index, item.name),
      translatedUnit: item.unit ? translated.units?.[item.unit] || item.unit : undefined
    })),
    additionalDescriptions: invoice.additionalDescriptions?.map((entry, index) => ({
      ...entry,
      translatedKey: translated.additionalDescriptions?.[index]?.key || entry.key,
      translatedValue: translated.additionalDescriptions?.[index]?.value || entry.value
    })),
    settlements: invoice.settlements
      ? {
          ...invoice.settlements,
          charges: invoice.settlements.charges?.map((line) => ({
            ...line,
            translatedReason: textAt(translated.settlementReasons, settlementIndex++, line.reason)
          })),
          deductions: invoice.settlements.deductions?.map((line) => ({
            ...line,
            translatedReason: textAt(translated.settlementReasons, settlementIndex++, line.reason)
          }))
        }
      : undefined,
    orders: invoice.orders?.map((order) => ({
      ...order,
      lines: order.lines?.map((line) => {
        const index = orderLines.indexOf(line);
        return {
          ...line,
          translatedName: index >= 0 ? textAt(translated.orderLines, index, line.name) : line.name,
          translatedUnit: line.unit ? translated.units?.[line.unit] || line.unit : undefined
        };
      })
    })),
    translatedNotes: textValue(translated.notes, invoice.notes),
    footer: invoice.footer
      ? {
          ...invoice.footer,
          translatedText: textValue(translated.footer, invoice.footer.text)
        }
      : undefined
  };
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function textAt(values: unknown[] | undefined, index: number, fallback?: string) {
  return textValue(values?.[index], fallback);
}

function textValue(value: unknown, fallback?: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}
