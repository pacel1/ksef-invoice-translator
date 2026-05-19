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
type TranslationRequestSection = "line_items" | "invoice_annotations";
type TranslationTaskKind =
  | "line_item"
  | "order_line"
  | "unit"
  | "annotation_key"
  | "annotation_value"
  | "settlement_reason"
  | "notes"
  | "footer";

type TranslationTask = {
  id: string;
  path: string;
  kind: TranslationTaskKind;
  source: string;
  context?: string;
};

type TaskTranslationResponse = {
  translations?: { id?: string; translated?: string }[];
};

const LINE_ITEMS_SYSTEM_PROMPT =
  'Translate each task.source according to task.kind and context. Use professional invoice terminology. Do not translate invoice numbers, dates, currencies, tax rates, amounts, VAT IDs, registration numbers, IBAN, SWIFT, company names, product codes, GTU, CN, PKWiU, PKOB, KSeF, or other legal identifiers. Return JSON only: { "translations": [{ "id": string, "translated": string }] }. Do not omit tasks and do not reorder ids.';

const INVOICE_ANNOTATIONS_SYSTEM_PROMPT =
  'Translate each task.source according to task.kind and context. Translate Polish natural-language keys and values. If any text is already in the target language, keep it unchanged. Do not translate company names, addresses, place names, VAT IDs, NIP, REGON, KRS, IBAN, SWIFT, KSeF, GTU, CN, PKWiU, legal article numbers, EU directive numbers, invoice numbers, dates, amounts, currencies, or tax rates. Return JSON only: { "translations": [{ "id": string, "translated": string }] }. Do not omit tasks and do not reorder ids.';

const TRANSLATION_ENGINE_PROMPT_VERSION = "free-text-v8-atomic-tasks";

export function getTranslationModel() {
  return process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4.1-nano";
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
  let translated = applyLocalAdditionalDescriptionKeyTranslations(initial.translation, fields, language);
  const issues = translationQualityIssues(fields, translated, language);
  const timings: Record<string, number | string | boolean> = {
    model: getTranslationModel(),
    language,
    initialItemsMs: initial.timings.itemsMs ?? 0,
    initialNotesMs: initial.timings.notesMs ?? 0,
    initialTaskCount: initial.taskCount,
    repairIssueCount: issues.length,
    repairIssues: issues.join(" | ").slice(0, 500)
  };

  if (issues.length) {
    const repairSections = repairSectionsForIssues(issues);
    const repairTaskIds = repairTaskIdsForIssues(issues);
    const repair = await requestSplitTranslation(client, targetLanguage, language, fields, {
      repairIssues: issues,
      sections: repairSections,
      taskIds: repairTaskIds
    });
    translated = applyLocalAdditionalDescriptionKeyTranslations(
      mergeTaskTranslation(translated, repair.translation, repairTaskIds),
      fields,
      language
    );
    if (repair.timings.itemsMs !== undefined) timings.repairItemsMs = repair.timings.itemsMs;
    if (repair.timings.notesMs !== undefined) timings.repairNotesMs = repair.timings.notesMs;
    timings.repairTaskCount = repair.taskCount;
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
  fields: TranslationFields,
  section: TranslationRequestSection,
  taskIds: Set<string> | undefined,
  repairIssues: string[] = []
): Promise<{ translation: TranslationPayload; taskCount: number }> {
  const systemPrompt = section === "line_items" ? LINE_ITEMS_SYSTEM_PROMPT : INVOICE_ANNOTATIONS_SYSTEM_PROMPT;
  const tasks = buildTranslationTasks(fields, section).filter((task) => !taskIds || taskIds.has(task.id));
  const payload = {
    sourceLanguage: "Polish",
    targetLanguage,
    targetLanguageCode: language,
    section,
    sectionGuidance: sectionGuidance(section),
    tasks
  };
  const completion = await client.chat.completions.create({
    model: getTranslationModel(),
    temperature: 0,
    max_tokens: estimateMaxTokens(payload),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: repairIssues.length
          ? `${systemPrompt} This is a repair attempt for the same section. Fix these quality issues: ${repairIssues.join("; ")}.`
          : systemPrompt
      },
      {
        role: "user",
        content: JSON.stringify(payload)
      }
    ]
  });

  const choice = completion.choices[0];
  if (choice?.finish_reason === "length") {
    throw new Error(`OpenAI translation response was truncated after ${completion.usage?.completion_tokens ?? "unknown"} completion tokens.`);
  }

  const content = choice?.message.content ?? "{}";
  return {
    translation: translationPayloadFromTasks(fields, section, tasks, safeJson(content) as TaskTranslationResponse),
    taskCount: tasks.length
  };
}

function estimateMaxTokens(fields: Record<string, unknown>) {
  const inputTokens = JSON.stringify(fields).length / 3.5;
  return Math.min(Math.max(Math.ceil(inputTokens * 1.3), 800), 4000);
}

async function requestSplitTranslation(
  client: OpenAI,
  targetLanguage: string,
  language: LanguageCode,
  fields: TranslationFields,
  options: { repairIssues?: string[]; sections: SplitSection[]; taskIds?: Set<string> }
): Promise<{ translation: TranslationPayload; timings: { itemsMs?: number; notesMs?: number }; taskCount: number }> {
  const repairIssues = options.repairIssues ?? [];
  const itemFields: TranslationFields = {
    items: fields.items,
    orderLines: fields.orderLines,
    units: fields.units,
    additionalDescriptions: [],
    settlementReasons: [],
    notes: "",
    footer: ""
  };
  const noteFields: TranslationFields = {
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
      ? timedTranslation(() => requestTranslation(client, targetLanguage, language, itemFields, "line_items", options.taskIds, repairIssues))
      : Promise.resolve(undefined),
    options.sections.includes("notes")
      ? timedTranslation(() => requestTranslation(client, targetLanguage, language, noteFields, "invoice_annotations", options.taskIds, repairIssues))
      : Promise.resolve(undefined)
  ]);
  const itemTranslation = itemResult?.result.translation;
  const noteTranslation = noteResult?.result.translation;

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
    },
    taskCount: (itemResult?.result.taskCount ?? 0) + (noteResult?.result.taskCount ?? 0)
  };
}

async function timedTranslation<T>(request: () => Promise<T>) {
  const started = performance.now();
  return {
    result: await request(),
    elapsedMs: elapsedMs(started)
  };
}

function buildTranslationTasks(fields: TranslationFields, section: TranslationRequestSection): TranslationTask[] {
  if (section === "line_items") {
    return [
      ...fields.items.map((source, index) => ({
        id: `items.${index}`,
        path: `items[${index}]`,
        kind: "line_item" as const,
        source,
        context: "invoice row description; translate if Polish natural language"
      })),
      ...fields.orderLines.map((source, index) => ({
        id: `orderLines.${index}`,
        path: `orderLines[${index}]`,
        kind: "order_line" as const,
        source,
        context: "order line description; translate if Polish natural language"
      })),
      ...fields.units.map((source, index) => ({
        id: `units.${index}`,
        path: `units[${index}]`,
        kind: "unit" as const,
        source,
        context: "unit of measure; translate common abbreviations when appropriate"
      }))
    ].filter((task) => task.source.trim());
  }

  return [
    ...fields.additionalDescriptions.flatMap((entry, index) => [
      {
        id: `additionalDescriptions.${index}.key`,
        path: `additionalDescriptions[${index}].key`,
        kind: "annotation_key" as const,
        source: entry.key,
        context: "field label or short descriptor; translate if Polish"
      },
      {
        id: `additionalDescriptions.${index}.value`,
        path: `additionalDescriptions[${index}].value`,
        kind: "annotation_value" as const,
        source: entry.value,
        context: "invoice clause, address, company name, location, or business description; translate Polish natural language and preserve identifiers"
      }
    ]),
    ...fields.settlementReasons.map((source, index) => ({
      id: `settlementReasons.${index}`,
      path: `settlementReasons[${index}]`,
      kind: "settlement_reason" as const,
      source,
      context: "settlement reason; translate if Polish natural language"
    })),
    {
      id: "notes",
      path: "notes",
      kind: "notes" as const,
      source: fields.notes,
      context: "invoice notes; translate if Polish natural language"
    },
    {
      id: "footer",
      path: "footer",
      kind: "footer" as const,
      source: fields.footer,
      context: "invoice footer; translate if Polish natural language"
    }
  ].filter((task) => task.source.trim());
}

function translationPayloadFromTasks(
  fields: TranslationFields,
  section: TranslationRequestSection,
  tasks: TranslationTask[],
  response: TaskTranslationResponse
): TranslationPayload {
  const translations = new Map(
    (response.translations ?? [])
      .filter((entry): entry is { id: string; translated: string } => typeof entry.id === "string" && typeof entry.translated === "string")
      .map((entry) => [entry.id, entry.translated])
  );

  if (section === "line_items") {
    const items: string[] = [];
    const orderLines: string[] = [];
    const units: Record<string, string> = {};
    for (const task of tasks) {
      const translated = translations.get(task.id);
      if (!translated) continue;
      const index = taskIndex(task.id);
      if (task.kind === "line_item") items[index] = translated;
      if (task.kind === "order_line") orderLines[index] = translated;
      if (task.kind === "unit") units[fields.units[index]] = translated;
    }
    return { items, orderLines, units };
  }

  const additionalDescriptions: { key?: string; value?: string }[] = [];
  const settlementReasons: string[] = [];
  let notes = "";
  let footer = "";

  for (const task of tasks) {
    const translated = translations.get(task.id);
    if (!translated) continue;
    const index = taskIndex(task.id);
    if (task.kind === "annotation_key") {
      additionalDescriptions[index] = { ...additionalDescriptions[index], key: translated };
    } else if (task.kind === "annotation_value") {
      additionalDescriptions[index] = { ...additionalDescriptions[index], value: translated };
    } else if (task.kind === "settlement_reason") {
      settlementReasons[index] = translated;
    } else if (task.kind === "notes") {
      notes = translated;
    } else if (task.kind === "footer") {
      footer = translated;
    }
  }

  return { additionalDescriptions, settlementReasons, notes, footer };
}

function mergeTaskTranslation(
  base: TranslationPayload,
  repair: TranslationPayload,
  taskIds: Set<string>
): TranslationPayload {
  const merged: TranslationPayload = {
    ...base,
    items: [...(base.items ?? [])],
    orderLines: [...(base.orderLines ?? [])],
    units: { ...(base.units ?? {}) },
    additionalDescriptions: [...(base.additionalDescriptions ?? [])],
    settlementReasons: [...(base.settlementReasons ?? [])]
  };

  for (const id of taskIds) {
    const index = taskIndex(id);
    if (id.startsWith("items.")) merged.items![index] = repair.items?.[index] ?? merged.items![index];
    if (id.startsWith("orderLines.")) merged.orderLines![index] = repair.orderLines?.[index] ?? merged.orderLines![index];
    if (id.startsWith("units.")) merged.units = { ...merged.units, ...(repair.units ?? {}) };
    if (id.endsWith(".key") && id.startsWith("additionalDescriptions.")) {
      merged.additionalDescriptions![index] = {
        ...merged.additionalDescriptions![index],
        key: repair.additionalDescriptions?.[index]?.key ?? merged.additionalDescriptions![index]?.key
      };
    }
    if (id.endsWith(".value") && id.startsWith("additionalDescriptions.")) {
      merged.additionalDescriptions![index] = {
        ...merged.additionalDescriptions![index],
        value: repair.additionalDescriptions?.[index]?.value ?? merged.additionalDescriptions![index]?.value
      };
    }
    if (id.startsWith("settlementReasons.")) {
      merged.settlementReasons![index] = repair.settlementReasons?.[index] ?? merged.settlementReasons![index];
    }
    if (id === "notes") merged.notes = repair.notes ?? merged.notes;
    if (id === "footer") merged.footer = repair.footer ?? merged.footer;
  }

  return merged;
}

function sectionGuidance(section: TranslationRequestSection) {
  if (section === "line_items") {
    return "items and orderLines are invoice row descriptions; units maps each original unit string to its translation.";
  }
  return "additionalDescriptions contains {key,value} pairs: key is a label/descriptor and value may be a clause, address, company name, location, or description; notes and footer are invoice text blocks.";
}

function taskIndex(id: string) {
  return Number(id.match(/\.(\d+)(?:\.|$)/)?.[1] ?? 0);
}

function repairSectionsForIssues(issues: string[]): SplitSection[] {
  const sections = new Set<SplitSection>();
  for (const issue of issues) {
    if (/^(items|orderLines)\[/.test(issue)) sections.add("items");
    if (/^(additionalDescriptions|settlementReasons)\[|^(notes|footer)\b/.test(issue)) sections.add("notes");
  }
  return sections.size ? Array.from(sections) : ["items", "notes"];
}

function repairTaskIdsForIssues(issues: string[]) {
  return new Set(
    issues.map((issue) => {
      const field = issue.split(" still contains untranslated Polish text:")[0] ?? "";
      return field
        .replace(/\[(\d+)\]/g, ".$1")
        .replace(/^\./, "");
    }).filter(Boolean)
  );
}

function applyLocalAdditionalDescriptionKeyTranslations(
  translated: TranslationPayload,
  fields: TranslationFields,
  language: LanguageCode
): TranslationPayload {
  if (!fields.additionalDescriptions.length || !translated.additionalDescriptions?.length) return translated;

  const additionalDescriptions = translated.additionalDescriptions.map((entry, index) => {
    const sourceKey = fields.additionalDescriptions[index]?.key;
    const local = localAdditionalDescriptionKeyTranslation(sourceKey, language);
    if (!local) return entry;

    const translatedKey = entry?.key;
    if (shouldBeTranslated(sourceKey) && (!translatedKey || unchanged(sourceKey, translatedKey) || hasPolishResidue(translatedKey, language))) {
      return { ...entry, key: local };
    }
    return entry;
  });

  return { ...translated, additionalDescriptions };
}

function localAdditionalDescriptionKeyTranslation(source: string | undefined, language: LanguageCode) {
  if (!source) return undefined;
  const normalized = source.trim().toLocaleLowerCase("pl-PL");
  return LOCAL_ADDITIONAL_DESCRIPTION_KEYS[normalized]?.[language];
}

const LOCAL_ADDITIONAL_DESCRIPTION_KEYS: Record<string, Partial<Record<LanguageCode, string>>> = {
  lokalizacja: { en: "Location", de: "Standort" },
  uwagi: { en: "Notes", de: "Anmerkungen" },
  opis: { en: "Description", de: "Beschreibung" },
  miejsce: { en: "Place", de: "Ort" },
  "miejsce wykonania": { en: "Place of performance", de: "Leistungsort" },
  "warunki płatności": { en: "Payment terms", de: "Zahlungsbedingungen" },
  "warunki platnosci": { en: "Payment terms", de: "Zahlungsbedingungen" },
  "opis zakresu": { en: "Scope description", de: "Leistungsbeschreibung" },
  "uwagi do faktury": { en: "Invoice notes", de: "Rechnungsanmerkungen" },
  "termin płatności": { en: "Payment due date", de: "Zahlungsfrist" },
  "termin platnosci": { en: "Payment due date", de: "Zahlungsfrist" },
  "sposób płatności": { en: "Payment method", de: "Zahlungsart" },
  "sposob platnosci": { en: "Payment method", de: "Zahlungsart" }
};

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
  if (looksLikeProtectedBusinessIdentifier(compact)) return false;
  if (/^[A-Z0-9_./ -]+$/.test(compact)) return false;
  return hasPolishSignals(compact);
}

function hasPolishSignals(value: string) {
  return /[ąćęłńóśźż]/i.test(value) || POLISH_FREE_TEXT_WORDS.test(value);
}

const POLISH_FREE_TEXT_WORDS =
  /\b(usługa|usluga|usługi|uslugi|lokalizacja|opis|uwagi|miejsce|przelewu|faktury|technicznej|techniczna|przygotowanie|dokumentacji|kontrahenta|podanie|płatność|platnosc|płatności|platnosci|termin|warunki|wykonania|zakresu|rozliczeń|rozliczen|sprzedaż|sprzedaz|dostawa|towarów|towarow|nabywcy|odbiorcy|rachunek|zapłaty|zaplaty)\b/i;

function looksLikeProtectedBusinessIdentifier(value: string) {
  const upperRatio = uppercaseLetterRatio(value);
  const hasAddressOrIdentifierMarker = /\b(ul\.|al\.|pl\.|nip|regon|krs|iban|swift|zoo|sp\.|s\.a\.|spółka|spolka)\b/i.test(value);
  const hasPostalCode = /\b\d{2}-\d{3}\b/.test(value);
  const hasManySeparators = (value.match(/[;,]/g) ?? []).length >= 2;
  const hasMostlyBusinessChars = /^[\p{L}0-9\s.,;:/()&'"-]+$/u.test(value);

  return hasMostlyBusinessChars && upperRatio > 0.6 && (hasAddressOrIdentifierMarker || hasPostalCode || hasManySeparators);
}

function uppercaseLetterRatio(value: string) {
  const letters = Array.from(value).filter((char) => /\p{L}/u.test(char));
  if (!letters.length) return 0;
  const uppercase = letters.filter((char) => char === char.toLocaleUpperCase("pl-PL") && char !== char.toLocaleLowerCase("pl-PL"));
  return uppercase.length / letters.length;
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
