import pdfParse from "pdf-parse";
import { invoiceSchema } from "@/lib/invoice/schema";
import type { BankAccount, Invoice, InvoiceItem, OrderInfo, TaxBreakdownLine } from "@/types/invoice";

type Registry = NonNullable<NonNullable<Invoice["footer"]>["registry"]>;

type PdfParseResult =
  | { ok: true; invoice: Invoice; warnings: string[]; rawText: string }
  | { ok: false; error: string };

const sectionNames = [
  "Sprzedawca",
  "Nabywca",
  "Szczegóły",
  "Pozycje",
  "Podsumowanie stawek podatku",
  "Adnotacje",
  "Dodatkowe informacje",
  "Płatność",
  "Warunki transakcji",
  "Rejestry",
  "Pozostałe informacje",
  "Sprawdź, czy Twoja faktura znajduje się w KSeF!",
  "Wytworzona w:"
];

export async function parseKsefPdf(buffer: Buffer): Promise<PdfParseResult> {
  try {
    const parsed = await pdfParse(buffer);
    const rawText = normalizePdfText(parsed.text);
    const rawBytesText = buffer.toString("latin1");
    const warnings = [
      "PDF parsed from rendered invoice text. XML remains the authoritative source when available."
    ];

    const seller = parseParty(section(rawText, "Sprzedawca", ["Nabywca"]));
    const buyer = parseParty(section(rawText, "Nabywca", ["Szczegóły"]));
    const currency = matchFirst(rawText, /walucie\s+([A-Z]{3})/i) ?? "PLN";
    const totals = parseTotals(rawText, currency);
    const taxBreakdown = parseTaxBreakdown(rawText, currency);
    const items = parseItems(rawText, currency, totals.gross, taxBreakdown);
    const invoiceType = invoiceTypeFromPdf(rawText);
    const invoice: Invoice = {
      invoiceNumber: requireValue(matchFirst(rawText, /Numer Faktury:\s*\n?\s*([^\n]+)/i), "invoice number"),
      invoiceType: invoiceType?.code,
      invoiceTypeLabel: invoiceType?.label,
      issueDate: normalizeDate(
        requireValue(
          matchFirst(rawText, /Data wystawienia[^:]*:\s*([0-9]{2}\.[0-9]{2}\.[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i),
          "issue date"
        )
      ) ?? requireValue(matchFirst(rawText, /Data wystawienia[^:]*:\s*([0-9]{2}\.[0-9]{2}\.[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i), "issue date"),
      saleDate: normalizeDate(
        matchFirst(
          rawText,
          /Data dokonania lub zakończenia dostawy towarów lub wykonania usługi:\s*(?:od\s*)?([0-9]{2}\.[0-9]{2}\.[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i
        )
      ),
      currency,
      seller,
      buyer,
      items,
      totals,
      payment: parsePayment(rawText),
      taxBreakdown,
      additionalDescriptions: parseAdditionalDescriptions(rawText),
      orders: parseOrders(rawText),
      notes: parseNotes(rawText),
      footer: parseFooter(rawText),
      verification: {
        ksefNumber: matchFirst(rawText, /Numer KSEF:\s*([A-Z0-9-]+)/i),
        qrLink: extractQrLink(rawText) ?? extractQrLink(rawBytesText)
      }
    };

    if (!invoice.verification?.qrLink) {
      warnings.push("No KSeF QR verification link was found in PDF text. If it exists only as a bitmap QR code, OCR/QR image decoding is needed.");
    }

    const validated = invoiceSchema.parse(invoice);
    return { ok: true, invoice: validated, warnings, rawText };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to parse KSeF PDF."
    };
  }
}

function parseParty(block: string) {
  const name = requireValue(matchFirst(block, /Nazwa:\s*([\s\S]*?)(?:\nAdres|\nDane kontaktowe|$)/i), "party name");
  const vatId = matchFirst(block, /(?:NIP|Numer VAT-UE):\s*([^\n]+)/i);
  const address = matchFirst(block, /Adres\s*\n([\s\S]*?)(?:\nDane kontaktowe|$)/i);

  return {
    name: cleanText(name) ?? name,
    vatId: cleanText(vatId),
    address: cleanText(address)
  };
}

function invoiceTypeFromPdf(text: string) {
  if (/Faktura zaliczkowa/i.test(text)) return { code: "ZAL", label: "Advance invoice" };
  if (/Faktura rozliczeniowa/i.test(text)) return { code: "ROZ", label: "Final settlement invoice" };
  if (/Faktura korygująca|Korekta/i.test(text)) return { code: "KOR", label: "Corrective invoice" };
  if (/Faktura podstawowa/i.test(text)) return { code: "VAT", label: "Basic invoice" };
  return undefined;
}

function parseTotals(text: string, currency: string) {
  const gross = numberFrom(matchFirst(text, /Kwota (?:należności ogółem|pozostała do zapłaty):\s*([\d\s]+,\d{2})\s*[A-Z]{3}/i));
  const taxLines = parseTaxBreakdown(text, currency) ?? [];
  const net = sum(taxLines.map((line) => line.net));
  const vat = sum(taxLines.map((line) => line.vat));

  return {
    net: net || gross,
    vat,
    gross: gross || net + vat
  };
}

function parseTaxBreakdown(text: string, currency: string): TaxBreakdownLine[] | undefined {
  const block = section(text, "Podsumowanie stawek podatku", ["Adnotacje", "Dodatkowe informacje", "Płatność"]);
  if (!block) return undefined;

  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^Lp\.?Stawka|^Kwota netto|^Kwota podatku|^Kwota brutto/i.test(line));
  const result: TaxBreakdownLine[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index];
    let amountMatches = [...line.matchAll(/(\d[\d\s]*,\d{2})/g)];
    while (amountMatches.length < 3 && index + 1 < lines.length) {
      index += 1;
      line = `${line} ${lines[index]}`;
      amountMatches = [...line.matchAll(/(\d[\d\s]*,\d{2})/g)];
    }
    const amounts = amountMatches.map((match) => numberFrom(match[1]));
    if (amounts.length < 3) continue;
    const rate = matchFirst(line, /(\d{1,2}%|np|zw)/i) ?? "VAT";
    const label = cleanTaxLabel(line.slice(0, amountMatches[0].index)) || rate;
    result.push({
      code: rate,
      label,
      net: amounts[amounts.length - 3],
      vat: amounts[amounts.length - 2],
      vatInPln: currency === "PLN" ? undefined : amounts[amounts.length - 2]
    });
  }

  return result.length ? result : undefined;
}

function parseItems(text: string, currency: string, grossTotal: number, taxBreakdown?: TaxBreakdownLine[]): InvoiceItem[] {
  const block = section(text, "Pozycje", ["Kwota należności ogółem", "Kwota pozostała do zapłaty"]);
  const rows = collectItemRows(block);
  const items = rows.map(parseItemRow).filter((item): item is InvoiceItem => Boolean(item));
  const separateIndices = extractSeparateIndices(block);
  items.forEach((item, index) => {
    item.index ??= separateIndices[index];
  });

  if (items.length) return items;

  const net = sum(taxBreakdown?.map((line) => line.net) ?? []) || grossTotal;
  const vat = sum(taxBreakdown?.map((line) => line.vat) ?? []);

  return [
    {
      name: "Pozycje z faktury PDF",
      quantity: 1,
      unit: "USŁUGA",
      unitPrice: net,
      netValue: net,
      vatRate: taxBreakdown?.[0]?.code ?? "VAT",
      grossValue: net + vat
    }
  ];
}

function collectItemRows(block: string) {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !isHeaderLine(line));
  const rows: string[] = [];

  for (const line of lines) {
    if (isLineItemStart(line)) {
      rows.push(line);
    } else if (rows.length && !line.startsWith("Lp.")) {
      rows[rows.length - 1] = `${rows[rows.length - 1]} ${line}`;
    }
  }

  return rows;
}

function parseItemRow(row: string): InvoiceItem | undefined {
  let value = row.replace(/\s+/g, " ").trim();
  value = value.replace(/^\d{1,3}\s+/, "").trim();
  value = value.replace(/^\d+(?:\/\d+)?(?=[A-ZĄĆĘŁŃÓŚŹŻ])/u, "").trim();

  const indexMatch = value.match(/\s([A-Z0-9][A-Z0-9/_-]{2,})$/);
  const index = indexMatch && !indexMatch[1].includes(",") ? indexMatch[1] : undefined;
  if (index) value = value.slice(0, -index.length).trim();

  const netMatch = value.match(/(\d[\d\s]*,\d{2})$/);
  if (!netMatch) return undefined;
  const netValue = numberFrom(netMatch[1]);
  value = value.slice(0, -netMatch[1].length).trim();

  const vatMatch = value.match(/(23%|22%|8%|5%|0%|np(?:\s+[A-Z]{1,3})?|zw)$/i);
  if (!vatMatch) return undefined;
  const vatRate = vatMatch[1];
  value = value.slice(0, -vatRate.length).trim();

  const quantityUnitMatch = value.match(/(\d+(?:,\d+)?)\s*([A-ZĄĆĘŁŃÓŚŹŻ.]+)$/);
  if (!quantityUnitMatch) return undefined;
  const quantity = numberFrom(quantityUnitMatch[1]);
  const unit = quantityUnitMatch[2];
  value = value.slice(0, -quantityUnitMatch[0].length).trim();

  const expectedUnitPrice = quantity ? netValue / quantity : netValue;
  const expectedUnitPriceText = formatPdfNumber(expectedUnitPrice);
  let unitPrice = expectedUnitPrice;
  if (value.endsWith(expectedUnitPriceText)) {
    value = value.slice(0, -expectedUnitPriceText.length).trim();
  } else {
    const unitPriceMatch = value.match(/(\d[\d\s]*,\d{2})$/);
    if (unitPriceMatch) {
      unitPrice = numberFrom(unitPriceMatch[1]);
      value = value.slice(0, -unitPriceMatch[1].length).trim();
    }
  }
  const name = cleanText(value);
  const numericVatRate = Number.parseFloat(vatRate.replace(",", "."));
  const vatValue = Number.isFinite(numericVatRate) ? netValue * (numericVatRate / 100) : 0;

  return {
    index,
    name: name || "Pozycja z faktury PDF",
    quantity,
    unit,
    unitPrice,
    netValue,
    vatRate,
    grossValue: netValue + vatValue
  };
}

function parsePayment(text: string): Invoice["payment"] {
  const block = section(text, "Płatność", ["Warunki transakcji", "Rejestry", "Pozostałe informacje"]);
  if (!block) return undefined;
  const bankAccounts = parseBankAccounts(block);

  return {
    dueDate: normalizeDate(matchFirst(block, /Termin płatności\s*\n\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}\.[0-9]{2}\.[0-9]{4})/i)),
    methodLabel: cleanText(matchFirst(block, /Forma płatności:\s*([^\n]+)/i)),
    isPaid: cleanText(matchFirst(block, /Informacja o płatności:\s*([^\n]+)/i)),
    bankAccount: bankAccounts[0]?.accountNumber,
    bankAccounts
  };
}

function parseBankAccounts(block: string): BankAccount[] {
  const parts = block.split(/Pełny numer\s+rachunku/i).slice(1);
  return parts
    .map<BankAccount | undefined>((part) => {
      const accountNumber = cleanText(matchFirst(part, /^\s*([A-Z]{2,3}\d{8,})/m));
      if (!accountNumber) return undefined;
      const swift = cleanText(matchFirst(part, /Kod SWIFT\s*([A-Z0-9]+)/i));
      const bankName = cleanText(matchFirst(part, /Nazwa banku\s*([\s\S]*?)(?:Opis rachunku|Numer rachunku bankowego|$)/i));
      const description = cleanText(matchFirst(part, /Opis rachunku\s*([A-Z]{3}|[^\n]+)/i));
      return { accountNumber, swift, bankName, description, type: "seller" as const };
    })
    .filter((account): account is BankAccount => Boolean(account));
}

function parseAdditionalDescriptions(text: string): Invoice["additionalDescriptions"] {
  const block = section(text, "Dodatkowy opis", ["Płatność"]);
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+/.test(line) && !line.startsWith("Lp."));

  return lines
    .slice(0, 20)
    .map((line) => cleanText(line.replace(/^\d+/, "")))
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value }));
}

function parseOrders(text: string): OrderInfo[] | undefined {
  const block = section(text, "Warunki transakcji", ["Rejestry", "Pozostałe informacje", "Sprawdź"]);
  const orderNumbers = matchFirst(block, /Numer zamówienia\s*([\s\S]*)/i)
    ?.split("\n")
    .map(cleanText)
    .filter((line) => line && !sectionNames.some((name) => line.startsWith(name)));

  return orderNumbers?.length ? orderNumbers.map((orderNumber) => ({ orderNumber })) : undefined;
}

function parseNotes(text: string) {
  return cleanText(section(text, "Adnotacje", ["Dodatkowe informacje", "Płatność"]));
}

function parseFooter(text: string): Invoice["footer"] {
  const footerText = cleanText(section(text, "Stopka faktury", ["Sprawdź, czy Twoja faktura znajduje się w KSeF!", "Wytworzona w:"]));
  const registryBlock = section(text, "Rejestry", ["Pozostałe informacje", "Sprawdź"]);
  const registry = parseRegistry(registryBlock);

  if (!footerText && !registry) return undefined;

  return {
    text: footerText || undefined,
    registry
  };
}

function parseRegistry(block: string): Registry | undefined {
  const lines = block
    .split("\n")
    .map(cleanText)
    .filter((line): line is string => Boolean(line))
    .filter((line) => !line.startsWith("Pełna nazwa"));
  if (!lines.length) return undefined;

  const numericIndex = lines.findIndex((line) => /^\d{18,}$/.test(line.replace(/\s/g, "")));
  if (numericIndex === -1) {
    return { fullName: lines.join(" ") };
  }

  const digits = lines[numericIndex].replace(/\s/g, "");
  const rest = digits.slice(10);
  const bdo = rest.length > 9 ? rest.slice(-9) : undefined;
  const regon = bdo ? rest.slice(0, -9) : rest || undefined;

  return {
    fullName: lines.slice(0, numericIndex).join(" ") || undefined,
    krs: digits.slice(0, 10) || undefined,
    regon,
    bdo
  };
}

function section(text: string, start: string, ends: string[]) {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) return "";
  const contentStart = startIndex + start.length;
  const endIndex = ends
    .map((end) => text.indexOf(end, contentStart))
    .filter((index) => index > -1)
    .sort((a, b) => a - b)[0];
  return text.slice(contentStart, endIndex ?? text.length).trim();
}

function normalizePdfText(text: string) {
  return text.replace(/\r/g, "\n").replace(/\u00a0/g, " ");
}

function cleanText(value?: string) {
  return value?.replace(/\s+/g, " ").trim();
}

function normalizeDate(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  const match = trimmed.match(/^([0-9]{2})\.([0-9]{2})\.([0-9]{4})$/);
  if (!match) return trimmed;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function numberFrom(value?: string) {
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPdfNumber(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function cleanTaxLabel(value: string) {
  const text = cleanText(value);
  if (!text) return undefined;
  return text
    .replace(/^1(?=\d{1,2}%)/, "")
    .replace(/^1(?=np|zw)/i, "")
    .replace(/^Lp\.Stawka podatkuKwota nettoKwota podatkuKwota brutto\s*/i, "")
    .trim();
}

function sum(values: Array<number | undefined>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function matchFirst(text: string, pattern: RegExp) {
  return text.match(pattern)?.[1]?.trim();
}

function requireValue(value: string | undefined, label: string) {
  if (!value) throw new Error(`Unable to extract ${label} from PDF.`);
  return value;
}

function extractQrLink(text: string) {
  return text.match(/https:\/\/qr\.ksef\.mf\.gov\.pl\/invoice\/[^\s<>()]+/i)?.[0];
}

function isHeaderLine(line: string) {
  return /^(Faktura wystawiona|Lp\.|Nazwa towaru|Cena jedn|netto$|Ilość|Miara|Stawka|podatku|Wartość|sprzedaży|Indeks$)/i.test(line);
}

function isLineItemStart(line: string) {
  return (
    /^\d{1,3}(?![\d,])\s+\S/.test(line) ||
    /^\d{1,3}(?=[A-ZĄĆĘŁŃÓŚŹŻ])/u.test(line) ||
    /^\d+(?:\/\d+)?(?=[A-ZĄĆĘŁŃÓŚŹŻ])/u.test(line)
  );
}

function extractSeparateIndices(block: string) {
  return block
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.match(/^\d{1,3}([A-Z0-9][A-Z0-9/_-]{2,})$/)?.[1])
    .filter((value): value is string => Boolean(value));
}
