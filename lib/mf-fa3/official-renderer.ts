import { xml2js } from "xml-js";
import * as pdfMakeVfs from "pdfmake/build/vfs_fonts";
import * as officialMfGenerator from "../../vendor/ksef-pdf-generator/dist/ksef-fe-invoice-converter.umd.cjs";
import { getBilingualLabels, getLabels } from "@/lib/translation/dictionaries";
import { getOfficialTextOverrides, OFFICIAL_LABEL_MAP } from "@/lib/mf-fa3/official-labels";
import type { Invoice, LanguageCode } from "@/types/invoice";

export type OfficialFa3RenderInput = {
  sourceXml: string;
  invoice: Invoice;
  language: LanguageCode;
  bilingual: boolean;
  translated: boolean;
};

export async function renderOfficialFa3Pdf({
  sourceXml,
  invoice,
  language,
  bilingual,
  translated
}: OfficialFa3RenderInput): Promise<Buffer> {
  const faktura = parseOfficialFa3Xml(sourceXml);
  ensureOfficialRenderableFa3(faktura, invoice);
  if (translated) {
    applyAppFreeTextToOfficialXml(faktura, invoice, bilingual);
  }
  const { generateFA3, initI18next, i18next } = officialGenerator();
  await initOfficialI18nextQuietly(initI18next);
  if (i18next?.options) i18next.options.debug = false;
  configureOfficialTranslations(i18next, language, bilingual, translated);
  await i18next?.changeLanguage?.(officialLanguage(translated));
  const pdf = generateFA3(faktura, officialAdditionalData(invoice));
  ensureRobotoVfs(pdf);
  return createdPdfToBuffer(pdf);
}

function ensureOfficialRenderableFa3(faktura: Record<string, any>, invoice: Invoice) {
  faktura.Fa ??= {};
  faktura.Fa.RodzajFaktury ??= { _text: invoice.invoiceType ?? "VAT" };
  faktura.Fa.P_2 ??= { _text: invoice.invoiceNumber };
  faktura.Fa.P_1 ??= { _text: invoice.issueDate };
  faktura.Fa.KodWaluty ??= { _text: invoice.currency };
}

function applyAppFreeTextToOfficialXml(faktura: Record<string, any>, invoice: Invoice, bilingual: boolean) {
  const fa = faktura.Fa;
  if (!fa) return;

  asArray(fa.FaWiersz).forEach((row, index) => {
    const item = invoice.items[index];
    if (!item) return;
    setText(row.P_7, translatedText(item.translatedName, item.name, bilingual));
    setText(row.P_8A, translatedText(item.translatedUnit, item.unit, bilingual));
  });

  asArray(fa.Zamowienie).forEach((order, orderIndex) => {
    const appOrder = invoice.orders?.[orderIndex];
    asArray(order?.ZamowienieWiersz).forEach((row, rowIndex) => {
      const line = appOrder?.lines?.[rowIndex];
      if (!line) return;
      setText(row.P_7Z, translatedText(line.translatedName, line.name, bilingual));
      setText(row.P_8AZ, translatedText(line.translatedUnit, line.unit, bilingual));
    });
  });

  asArray(fa.DodatkowyOpis).forEach((entry, index) => {
    const description = invoice.additionalDescriptions?.[index];
    if (!description) return;
    setText(entry.Klucz, translatedText(description.translatedKey, description.key, bilingual));
    setText(entry.Wartosc, translatedText(description.translatedValue, description.value, bilingual));
  });

  if (faktura.Stopka?.StopkaFaktury) {
    setText(faktura.Stopka.StopkaFaktury, translatedText(invoice.footer?.translatedText, invoice.footer?.text, bilingual));
  }
}

export function parseOfficialFa3Xml(sourceXml: string): Record<string, any> {
  const parsed = xml2js(sourceXml, {
    compact: true,
    cdataKey: "_text",
    trim: true,
    elementNameFn: stripPrefix,
    attributeNameFn: stripPrefix
  }) as { Faktura?: Record<string, any> };

  if (!parsed.Faktura) {
    throw new Error("Official MF renderer could not find Faktura root element.");
  }

  const kodSystemowy = parsed.Faktura.Naglowek?.KodFormularza?._attributes?.kodSystemowy;
  if (kodSystemowy !== "FA (3)") {
    throw new Error(`Official MF renderer supports only FA (3), got ${kodSystemowy || "unknown schema"}.`);
  }

  return parsed.Faktura;
}

function stripPrefix(key: string) {
  return key.includes(":") ? key.split(":")[1] : key;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function setText(node: { _text?: string } | undefined, value: string | undefined) {
  if (node && value) node._text = value;
}

function translatedText(translated: string | undefined, original: string | undefined, bilingual: boolean) {
  if (!translated || translated === original) return original;
  if (!bilingual || !original) return translated;
  return `${translated}\n${original}`;
}

function officialAdditionalData(invoice: Invoice) {
  return {
    nrKSeF: invoice.verification?.ksefNumber ?? "",
    qrCode: invoice.verification?.qrLink,
    isMobile: false
  };
}

function officialLanguage(translated: boolean) {
  if (!translated) return "pl";
  return "app";
}

function officialGenerator(): {
  generateFA3: (faktura: Record<string, any>, additionalData: Record<string, unknown>) => any;
  initI18next: () => Promise<void>;
  i18next?: {
    options?: { debug?: boolean };
    addResourceBundle?: (
      language: string,
      namespace: string,
      resources: Record<string, unknown>,
      deep?: boolean,
      overwrite?: boolean
    ) => void;
    getResourceBundle?: (language: string, namespace: string) => Record<string, unknown>;
    changeLanguage?: (language: string) => Promise<unknown>;
  };
} {
  return officialMfGenerator as unknown as {
    generateFA3: (faktura: Record<string, any>, additionalData: Record<string, unknown>) => any;
    initI18next: () => Promise<void>;
    i18next?: {
      options?: { debug?: boolean };
      addResourceBundle?: (
        language: string,
        namespace: string,
        resources: Record<string, unknown>,
        deep?: boolean,
        overwrite?: boolean
      ) => void;
      getResourceBundle?: (language: string, namespace: string) => Record<string, unknown>;
      changeLanguage?: (language: string) => Promise<unknown>;
    };
  };
}

function configureOfficialTranslations(
  i18next: ReturnType<typeof officialGenerator>["i18next"],
  language: LanguageCode,
  bilingual: boolean,
  translated: boolean
) {
  if (!translated || !i18next?.addResourceBundle || !i18next.getResourceBundle) return;

  const polishBundle = i18next.getResourceBundle("pl", "translation");
  const appBundle = structuredCloneSafe(polishBundle);
  const labels = bilingual ? getBilingualLabels(language) : getLabels(language);

  for (const [path, labelKey] of Object.entries(OFFICIAL_LABEL_MAP)) {
    setNestedValue(appBundle, path, labels[labelKey] ?? labelKey);
  }

  const staticTranslations = getOfficialTextOverrides(language);
  for (const [path, translatedValue] of Object.entries(staticTranslations)) {
    const polishValue = getNestedString(polishBundle, path);
    const value = bilingual && polishValue && translatedValue !== polishValue
      ? `${translatedValue} / ${polishValue}`
      : translatedValue;
    setNestedValue(appBundle, path, value);
  }

  i18next.addResourceBundle("app", "translation", appBundle, true, true);
}

function getNestedString(target: Record<string, unknown>, path: string) {
  let current: unknown = target;
  for (const key of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setNestedValue(target: Record<string, unknown>, path: string, value: string) {
  const keys = path.split(".");
  let current: Record<string, unknown> = target;

  keys.slice(0, -1).forEach((key) => {
    const next = current[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) current[key] = {};
    current = current[key] as Record<string, unknown>;
  });

  current[keys[keys.length - 1]] = value;
}

async function initOfficialI18nextQuietly(initI18next: () => Promise<void>) {
  const originalLog = console.log;
  const originalInfo = console.info;
  const shouldSilence = (args: unknown[]) => {
    const first = String(args[0] ?? "");
    return first.startsWith("i18next:") || first.includes("i18next is maintained");
  };

  console.log = (...args: unknown[]) => {
    if (!shouldSilence(args)) originalLog(...args);
  };
  console.info = (...args: unknown[]) => {
    if (!shouldSilence(args)) originalInfo(...args);
  };

  try {
    await initI18next();
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
  }
}

function ensureRobotoVfs(pdf: { vfs?: Record<string, string> }) {
  if (pdf.vfs?.["Roboto-Regular.ttf"]) return;
  const vfs = pdfMakeVfs as unknown as Record<string, string> & { default?: Record<string, string> };
  pdf.vfs = { ...(vfs["Roboto-Regular.ttf"] ? vfs : vfs.default ?? {}) };
}

function createdPdfToBuffer(pdf: { getBuffer: (callback: (buffer: Buffer | Uint8Array) => void) => void }): Promise<Buffer> {
  return new Promise((resolve) => {
    pdf.getBuffer((buffer: Buffer | Uint8Array) => {
      resolve(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
    });
  });
}
