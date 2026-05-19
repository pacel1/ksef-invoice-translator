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

type TranslationFields = {
  items: string[];
  orderLines: string[];
  units: string[];
  additionalDescriptions: { key: string; value: string }[];
  settlementReasons: string[];
  notes: string;
  footer: string;
};

type SplitSection = "items" | "notes";

const SYSTEM_PROMPT =
  "You translate Polish invoice free-text into the requested target language. Translate every natural-language business phrase, including short keys and labels supplied by the invoice data such as Lokalizacja, Uwagi, Opis, and Miejsce. Never leave Polish words mixed into the translated result unless they are part of a company name, product code, legal identifier, KSeF, or another proper noun. Do not translate invoice numbers, dates, currencies, tax rates, amounts, VAT IDs, registration numbers, IBAN, SWIFT, bank account numbers, company names, product codes, GTU, CN, PKWiU, PKOB, or registry numbers. Preserve meaning, keep professional invoice terminology, and preserve the order and array lengths exactly. Return strict JSON with keys items:string[], orderLines:string[], units:object, additionalDescriptions:{key:string,value:string}[], settlementReasons:string[], notes:string, and footer:string. The units object must map each original unit string exactly to its translation.";

const TRANSLATION_ENGINE_PROMPT_VERSION = "free-text-v3-split-repair";

export function getTranslationModel() {
  return process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4.1-mini";
}

export function getTranslationEngineVersion() {
  return `${TRANSLATION_ENGINE_PROMPT_VERSION}:${getTranslationModel()}`;
}

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
  const translationStarted = performance.now();
  const initial = await requestSplitTranslation(client, targetLanguage, language, fields, {
    sections: ["items", "notes"]
  });
  let translated = initial.translation;
  const issues = translationQualityIssues(fields, translated, language);
  const timings: Record<string, number | string | boolean> = {
    model: getTranslationModel(),
    language,
    initialItemsMs: initial.timings.itemsMs ?? 0,
    initialNotesMs: initial.timings.notesMs ?? 0,
    repairIssueCount: issues.length
  };

  if (issues.length) {
    const repairSections = repairSectionsForIssues(issues);
    const repair = await requestSplitTranslation(client, targetLanguage, language, fields, {
      repairIssues: issues,
      sections: repairSections
    });
    translated = mergeSplitTranslation(translated, repair.translation, repairSections);
    if (repair.timings.itemsMs !== undefined) timings.repairItemsMs = repair.timings.itemsMs;
    if (repair.timings.notesMs !== undefined) timings.repairNotesMs = repair.timings.notesMs;
  }
  timings.totalMs = elapsedMs(translationStarted);
  console.info("[translation-engine] timings", timings);

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
    model: getTranslationModel(),
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

async function requestSplitTranslation(
  client: OpenAI,
  targetLanguage: string,
  language: LanguageCode,
  fields: TranslationFields,
  options: { repairIssues?: string[]; sections: SplitSection[] }
): Promise<{ translation: TranslationPayload; timings: { itemsMs?: number; notesMs?: number } }> {
  const repairIssues = options.repairIssues ?? [];
  const itemFields = {
    items: fields.items,
    orderLines: fields.orderLines,
    units: fields.units,
    additionalDescriptions: [],
    settlementReasons: [],
    notes: "",
    footer: ""
  };
  const noteFields = {
    items: [],
    orderLines: [],
    units: [],
    additionalDescriptions: fields.additionalDescriptions,
    settlementReasons: fields.settlementReasons,
    notes: fields.notes,
    footer: fields.footer
  };

  const [itemResult, noteResult] = await Promise.all([
    options.sections.includes("items")
      ? timedTranslation(() => requestTranslation(client, targetLanguage, language, itemFields, repairIssues))
      : Promise.resolve(undefined),
    options.sections.includes("notes")
      ? timedTranslation(() => requestTranslation(client, targetLanguage, language, noteFields, repairIssues))
      : Promise.resolve(undefined)
  ]);
  const itemTranslation = itemResult?.translation;
  const noteTranslation = noteResult?.translation;

  return {
    translation: {
      items: Array.isArray(itemTranslation?.items) ? itemTranslation.items : [],
      orderLines: Array.isArray(itemTranslation?.orderLines) ? itemTranslation.orderLines : [],
      units: itemTranslation?.units && typeof itemTranslation.units === "object" ? itemTranslation.units : {},
      additionalDescriptions: Array.isArray(noteTranslation?.additionalDescriptions) ? noteTranslation.additionalDescriptions : [],
      settlementReasons: Array.isArray(noteTranslation?.settlementReasons) ? noteTranslation.settlementReasons : [],
      notes: typeof noteTranslation?.notes === "string" ? noteTranslation.notes : "",
      footer: typeof noteTranslation?.footer === "string" ? noteTranslation.footer : ""
    },
    timings: {
      itemsMs: itemResult?.elapsedMs,
      notesMs: noteResult?.elapsedMs
    }
  };
}

async function timedTranslation(request: () => Promise<TranslationPayload>) {
  const started = performance.now();
  return {
    translation: await request(),
    elapsedMs: elapsedMs(started)
  };
}

function mergeSplitTranslation(
  base: TranslationPayload,
  repair: TranslationPayload,
  sections: SplitSection[]
): TranslationPayload {
  return {
    ...base,
    ...(sections.includes("items")
      ? {
          items: repair.items,
          orderLines: repair.orderLines,
          units: repair.units
        }
      : {}),
    ...(sections.includes("notes")
      ? {
          additionalDescriptions: repair.additionalDescriptions,
          settlementReasons: repair.settlementReasons,
          notes: repair.notes,
          footer: repair.footer
        }
      : {})
  };
}

function repairSectionsForIssues(issues: string[]): SplitSection[] {
  const sections = new Set<SplitSection>();
  for (const issue of issues) {
    if (/^(items|orderLines)\[/.test(issue)) sections.add("items");
    if (/^(additionalDescriptions|settlementReasons)\[|^(notes|footer)\b/.test(issue)) sections.add("notes");
  }
  return sections.size ? Array.from(sections) : ["items", "notes"];
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

function elapsedMs(started: number) {
  return Math.round(performance.now() - started);
}
