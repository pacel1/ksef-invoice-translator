import OpenAI from "openai";
import type { Invoice, LanguageCode, TranslatedInvoice } from "@/types/invoice";
import { translationTargets } from "@/lib/translation/languages";
import { getPaymentMethodLabel } from "@/lib/translation/payment-methods";

type TranslationPayload = {
  items?: string[];
  orderLines?: string[];
  units?: Record<string, string>;
  additionalDescriptions?: { key?: string; value?: string }[];
  settlementReasons?: string[];
  notes?: string;
  footer?: string;
};

const SYSTEM_PROMPT =
  "You translate Polish invoice free-text into the requested target language. Translate every natural-language business phrase, including short keys and labels supplied by the invoice data such as Lokalizacja, Uwagi, Opis, and Miejsce. Never leave Polish words mixed into the translated result unless they are part of a company name, product code, legal identifier, KSeF, or another proper noun. Do not translate invoice numbers, dates, currencies, tax rates, amounts, VAT IDs, registration numbers, IBAN, SWIFT, bank account numbers, company names, product codes, GTU, CN, PKWiU, PKOB, or registry numbers. Preserve meaning, keep professional invoice terminology, and preserve the order and array lengths exactly. Return strict JSON with keys items:string[], orderLines:string[], units:object, additionalDescriptions:{key:string,value:string}[], settlementReasons:string[], notes:string, and footer:string. The units object must map each original unit string exactly to its translation.";

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
      ...withTranslatedPaymentMethods(invoice, language),
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
  let translated = await requestTranslation(client, targetLanguage, language, fields);
  const issues = translationQualityIssues(fields, translated, language);

  if (issues.length) {
    translated = await requestTranslation(client, targetLanguage, language, fields, issues);
  }

  let settlementIndex = 0;
  return {
    ...withTranslatedPaymentMethods(invoice, language),
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

async function requestTranslation(
  client: OpenAI,
  targetLanguage: string,
  language: LanguageCode,
  fields: Record<string, unknown>,
  repairIssues: string[] = []
): Promise<TranslationPayload> {
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4.1-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: repairIssues.length
          ? `${SYSTEM_PROMPT} This is a repair attempt. Fix these quality issues: ${repairIssues.join("; ")}.`
          : SYSTEM_PROMPT
      },
      {
        role: "user",
        content: JSON.stringify({ sourceLanguage: "Polish", targetLanguage, targetLanguageCode: language, fields })
      }
    ]
  });

  const content = completion.choices[0]?.message.content ?? "{}";
  return safeJson(content) as TranslationPayload;
}

function withTranslatedPaymentMethods(invoice: Invoice, language: LanguageCode): Invoice {
  if (!invoice.payment) return invoice;

  return {
    ...invoice,
    payment: {
      ...invoice.payment,
      methodLabel: getPaymentMethodLabel(invoice.payment.method, language) ?? invoice.payment.methodLabel,
      partialPayments: invoice.payment.partialPayments?.map((payment) => ({
        ...payment,
        method: getPaymentMethodLabel(payment.method, language) ?? payment.method
      }))
    }
  };
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function translationQualityIssues(
  fields: {
    items: string[];
    orderLines: string[];
    additionalDescriptions: { key: string; value: string }[];
    settlementReasons: string[];
    notes: string;
    footer: string;
  },
  translated: TranslationPayload,
  language: LanguageCode
) {
  const checks: { source: string; translated?: string; field: string }[] = [
    ...fields.items.map((source, index) => ({ source, translated: translated.items?.[index], field: `items[${index}]` })),
    ...fields.orderLines.map((source, index) => ({ source, translated: translated.orderLines?.[index], field: `orderLines[${index}]` })),
    ...fields.additionalDescriptions.flatMap((entry, index) => [
      { source: entry.key, translated: translated.additionalDescriptions?.[index]?.key, field: `additionalDescriptions[${index}].key` },
      { source: entry.value, translated: translated.additionalDescriptions?.[index]?.value, field: `additionalDescriptions[${index}].value` }
    ]),
    ...fields.settlementReasons.map((source, index) => ({
      source,
      translated: translated.settlementReasons?.[index],
      field: `settlementReasons[${index}]`
    })),
    { source: fields.notes, translated: translated.notes, field: "notes" },
    { source: fields.footer, translated: translated.footer, field: "footer" }
  ];

  return checks
    .filter(({ source, translated }) => shouldBeTranslated(source) && (!translated || unchanged(source, translated) || hasPolishResidue(translated, language)))
    .slice(0, 8)
    .map(({ field, source }) => `${field} still contains untranslated Polish text: ${source}`);
}

function shouldBeTranslated(value: string | undefined) {
  if (!value) return false;
  const compact = value.trim();
  if (compact.length < 4) return false;
  if (/^[A-Z0-9_./ -]+$/.test(compact)) return false;
  return /[a-ząćęłńóśźż]|\b(usługa|lokalizacja|opis|uwagi|miejsce|przelewu|faktury|technicznej)\b/i.test(compact);
}

function unchanged(source: string, translated: string) {
  return source.trim().toLocaleLowerCase("pl-PL") === translated.trim().toLocaleLowerCase("pl-PL");
}

function hasPolishResidue(value: string, language: LanguageCode) {
  if (language === "en") return false;
  return /\b(usługa|usluga|lokalizacja|przygotowanie|dokumentacji|technicznej|kontrahenta|faktury|przelewu|podanie)\b/i.test(value);
}

function textAt(values: unknown[] | undefined, index: number, fallback?: string) {
  return textValue(values?.[index], fallback);
}

function textValue(value: unknown, fallback?: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}
