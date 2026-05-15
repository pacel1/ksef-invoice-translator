import { XMLParser, XMLValidator } from "fast-xml-parser";
import type {
  AdditionalDescription,
  BankAccount,
  Invoice,
  InvoiceFooter,
  InvoiceItem,
  OrderInfo,
  OrderLine,
  PaymentTerm,
  SettlementLine,
  TaxBreakdownLine
} from "@/types/invoice";
import { getPaymentMethodLabel } from "@/lib/translation/payment-methods";
import { invoiceSchema } from "@/lib/invoice/schema";

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  removeNSPrefix: true
});

export type ParseResult =
  | { ok: true; invoice: Invoice; warnings: string[] }
  | { ok: false; error: string; warnings: string[] };

export function parseKsefXml(xml: string): ParseResult {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    return {
      ok: false,
      error: `Malformed XML near line ${validation.err.line}: ${validation.err.msg}`,
      warnings: []
    };
  }

  try {
    const parsed = parser.parse(xml) as XmlNode;
    const root = unwrapRoot(parsed);
    const fa = pickObject(root, ["Faktura", "Fa"]) ?? root;
    const podmiot1 = pickObject(root, ["Podmiot1"]) ?? {};
    const podmiot2 = pickObject(root, ["Podmiot2"]) ?? {};
    const platnosc = pickObject(root, ["Platnosc"]) ?? {};
    const stopka = pickObject(root, ["Stopka"]) ?? {};
    const orders = ordersFromNode(fa);
    const directItems = normalizeItems(findAllObjects(root, "FaWiersz"));
    const items = directItems.length ? directItems : itemsFromOrderLines(orders);
    const usedOrderLinesAsItems = !directItems.length && items.length > 0;
    const totalsFromItems = totalsFromLineItems(items);
    const payment = paymentFromNode(platnosc);
    const taxBreakdown = taxBreakdownFromNode(fa);
    const totalsFromTax = totalsFromTaxBreakdown(taxBreakdown);
    const additionalDescriptions = additionalDescriptionsFromNode(root);
    const notes = notesFromAdditionalDescriptions(additionalDescriptions);

    const invoice: Invoice = {
      invoiceNumber: text(firstDefined(getPath(fa, ["P_2"]), findValue(root, "P_2"))) || "UNKNOWN",
      invoiceType: text(findValue(fa, "RodzajFaktury")) || undefined,
      invoiceTypeLabel: invoiceTypeLabel(text(findValue(fa, "RodzajFaktury"))) || undefined,
      issueDate: text(firstDefined(getPath(fa, ["P_1"]), findValue(root, "P_1"))) || "",
      saleDate: text(firstDefined(getPath(fa, ["P_6"]), findValue(root, "P_6"))) || undefined,
      currency: text(firstDefined(getPath(fa, ["KodWaluty"]), findValue(root, "KodWaluty"))) || "PLN",
      seller: partyFromNode(podmiot1),
      buyer: partyFromNode(podmiot2),
      items,
      totals: {
        net: totalsFromTax.net || totalsFromItems.net,
        vat: totalsFromTax.vat || totalsFromItems.vat,
        gross: numberFrom(firstDefined(findValue(fa, "P_15"), findValue(root, "P_15")), totalsFromItems.gross)
      },
      payment,
      taxBreakdown,
      additionalDescriptions,
      thirdParties: findAllObjects(root, "Podmiot3").map(partyFromNode),
      authorizedParty: partyOrUndefined(pickObject(root, ["PodmiotUpowazniony"])),
      settlements: settlementsFromNode(pickObject(fa, ["Rozliczenie"])),
      orders,
      notes: notes || text(findValue(root, "Uwagi")) || undefined,
      footer: footerFromNode(stopka)
    };

    const validated = invoiceSchema.parse(invoice);
    const warnings = buildWarnings(validated, usedOrderLinesAsItems);
    return { ok: true, invoice: validated, warnings };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to parse invoice XML.",
      warnings: []
    };
  }
}

function unwrapRoot(node: XmlNode): XmlNode {
  const keys = Object.keys(node).filter((key) => !key.startsWith("@_"));
  if (keys.length === 1 && isObject(node[keys[0]])) return node[keys[0]] as XmlNode;
  return node;
}

function partyFromNode(node: unknown) {
  const party = isObject(node) ? node : {};
  const ident = pickObject(party, ["DaneIdentyfikacyjne"]) ?? {};
  const adres = pickObject(party, ["Adres"]) ?? {};
  return {
    name: text(firstDefined(findValue(ident, "Nazwa"), findValue(party, "Nazwa"))) || "Unknown party",
    vatId:
      text(firstDefined(findValue(ident, "NIP"), findValue(party, "NIP"))) ||
      joinCompact([text(findValue(ident, "KodUE")), text(findValue(ident, "NrVatUE"))]) ||
      undefined,
    address: addressFromNode(adres) || undefined
  };
}

function addressFromNode(node: unknown) {
  if (!isObject(node)) return "";
  const fields = ["KodKraju", "AdresL1", "AdresL2", "Ulica", "NrDomu", "NrLokalu", "KodPocztowy", "Miejscowosc"];
  const values = fields.map((field) => text(findValue(node, field))).filter(Boolean);
  return Array.from(new Set(values)).join(", ");
}

function normalizeItems(nodes: XmlNode[]): InvoiceItem[] {
  return nodes.map((node, index) => {
    const net = numberFrom(firstDefined(findValue(node, "P_11"), findValue(node, "P_11A")), 0);
    const vatRate = text(firstDefined(findValue(node, "P_12"), findValue(node, "StawkaPodatku"))) || "0";
    const rate = vatRate.includes("zw") || vatRate.includes("np") ? 0 : Number.parseFloat(vatRate.replace(",", "."));
    const gross = numberFrom(findValue(node, "P_11Vat"), Number.isFinite(rate) ? net * (1 + rate / 100) : net);

    return {
      index: text(firstDefined(findValue(node, "Indeks"), findValue(node, "GTIN"), findValue(node, "PKWiU"), findValue(node, "CN"))) || undefined,
      name: text(firstDefined(findValue(node, "P_7"), findValue(node, "Nazwa"))) || `Invoice item ${index + 1}`,
      quantity: numberFrom(firstDefined(findValue(node, "P_8B"), findValue(node, "Ilosc")), 1),
      unit: text(firstDefined(findValue(node, "P_8A"), findValue(node, "JM"))) || undefined,
      unitPrice: numberFrom(firstDefined(findValue(node, "P_9A"), findValue(node, "CenaJednostkowa")), net),
      netValue: net,
      vatRate,
      grossValue: gross
    };
  });
}

function paymentFromNode(node: unknown): Invoice["payment"] | undefined {
  if (!isObject(node)) return undefined;
  const bankAccounts = mapBankAccounts(findAllObjects(node, "RachunekBankowy"), "seller");
  const factorBankAccounts = mapBankAccounts(findAllObjects(node, "RachunekBankowyFaktora"), "factor");
  const paymentTerms = paymentTermsFromNode(node);
  const partialPayments = findAllObjects(node, "ZaplataCzesciowa").map((entry) => ({
    amount: optionalNumber(findValue(entry, "KwotaZaplatyCzesciowej")),
    date: text(findValue(entry, "DataZaplatyCzesciowej")) || undefined,
    method: paymentMethodLabel(text(findValue(entry, "FormaPlatnosci"))) || text(findValue(entry, "FormaPlatnosci")) || undefined,
    otherMethodDescription: text(findValue(entry, "OpisPlatnosci")) || undefined
  }));
  const discounts = findAllObjects(node, "Skonto").map((entry) => ({
    conditions: text(firstDefined(findValue(entry, "WarunkiSkonta"), findValue(entry, "OpisSkonta"), findValue(entry, "WarunekSkonta"))) || undefined,
    amount: optionalNumber(firstDefined(findValue(entry, "WysokoscSkonta"), findValue(entry, "KwotaSkonta")))
  }));
  const methodCode = text(findValue(node, "FormaPlatnosci"));
  const firstTerm = paymentTerms[0];

  const payment = {
    dueDate: firstTerm?.dueDate,
    method: methodCode || undefined,
    methodLabel: paymentMethodLabel(methodCode) || undefined,
    isPaid: text(findValue(node, "Zaplacono")) || undefined,
    paidDate: text(findValue(node, "DataZaplaty")) || undefined,
    otherMethodDescription: text(findValue(node, "OpisPlatnosci")) || undefined,
    bankAccount: bankAccounts[0]?.accountNumber,
    bankAccounts,
    factorBankAccounts,
    paymentTerms,
    partialPayments,
    discounts,
    paymentLink: text(findValue(node, "LinkDoPlatnosci")) || undefined,
    ipKsef: text(findValue(node, "IPKSeF")) || undefined
  };

  return Object.values(payment).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)))
    ? payment
    : undefined;
}

function paymentTermsFromNode(node: XmlNode): PaymentTerm[] {
  return findAllObjects(node, "TerminPlatnosci")
    .map((entry) => ({
      dueDate: text(firstDefined(findValue(entry, "Termin"), getPrimitive(entry))) || undefined,
      description: text(firstDefined(findValue(entry, "TerminOpis"), findValue(entry, "OpisTerminu"))) || undefined
    }))
    .filter((term) => term.dueDate || term.description);
}

function mapBankAccounts(nodes: XmlNode[], type: BankAccount["type"]): BankAccount[] {
  return nodes
    .map((node) => ({
      accountNumber: text(findValue(node, "NrRB")),
      swift: text(findValue(node, "SWIFT")) || undefined,
      bankName: text(findValue(node, "NazwaBanku")) || undefined,
      description: text(findValue(node, "OpisRachunku")) || undefined,
      type
    }))
    .filter((account) => account.accountNumber);
}

function footerFromNode(node: unknown): InvoiceFooter | undefined {
  if (!isObject(node)) return undefined;
  const textValue = text(findValue(node, "StopkaFaktury")) || undefined;
  const registry = pickObject(node, ["Rejestry"]);
  const footer: InvoiceFooter = {
    text: textValue,
    registry: registry
      ? {
          fullName: text(findValue(registry, "PelnaNazwa")) || undefined,
          krs: text(findValue(registry, "KRS")) || undefined,
          regon: text(findValue(registry, "REGON")) || undefined,
          bdo: text(findValue(registry, "BDO")) || undefined
        }
      : undefined
  };
  return footer.text || footer.registry ? footer : undefined;
}

function additionalDescriptionsFromNode(root: XmlNode): AdditionalDescription[] {
  return findAllObjects(root, "DodatkowyOpis")
    .map((entry) => ({
      lineNumber: text(findValue(entry, "NrWiersza")) || undefined,
      key: text(findValue(entry, "Klucz")) || undefined,
      value: text(findValue(entry, "Wartosc"))
    }))
    .filter((entry) => entry.value);
}

function notesFromAdditionalDescriptions(descriptions: AdditionalDescription[]) {
  return descriptions
    .filter((entry) => !entry.lineNumber)
    .map((entry) => [entry.key, entry.value].filter(Boolean).join(": "))
    .join("\n");
}

function taxBreakdownFromNode(fa: XmlNode): TaxBreakdownLine[] {
  const definitions = [
    ["1", "Basic rate 23% / 22%", "P_13_1", "P_14_1", "P_14_1W"],
    ["2", "Reduced rate 8% / 7%", "P_13_2", "P_14_2", "P_14_2W"],
    ["3", "Reduced rate 5%", "P_13_3", "P_14_3", "P_14_3W"],
    ["4", "Taxi flat-rate scheme", "P_13_4", "P_14_4", "P_14_4W"],
    ["5", "Special OSS/IOSS procedure", "P_13_5", "P_14_5", undefined],
    ["6_1", "0% rate", "P_13_6_1", undefined, undefined],
    ["6_2", "0% intra-Community supply", "P_13_6_2", undefined, undefined],
    ["6_3", "0% export", "P_13_6_3", undefined, undefined],
    ["7", "Tax-exempt sales", "P_13_7", undefined, undefined],
    ["8", "Supply outside Poland", "P_13_8", undefined, undefined],
    ["9", "EU services Art. 100", "P_13_9", undefined, undefined],
    ["10", "Reverse charge", "P_13_10", undefined, undefined],
    ["11", "Margin scheme", "P_13_11", undefined, undefined]
  ] as const;

  return definitions
    .map(([code, label, netKey, vatKey, vatPlnKey]) => ({
      code,
      label,
      net: optionalNumber(findValue(fa, netKey)),
      vat: vatKey ? optionalNumber(findValue(fa, vatKey)) : undefined,
      vatInPln: vatPlnKey ? optionalNumber(findValue(fa, vatPlnKey)) : undefined
    }))
    .filter((line) => line.net !== undefined || line.vat !== undefined || line.vatInPln !== undefined);
}

function totalsFromTaxBreakdown(lines: TaxBreakdownLine[]) {
  const net = lines.reduce((sum, line) => sum + (line.net ?? 0), 0);
  const vat = lines.reduce((sum, line) => sum + (line.vat ?? 0), 0);
  return { net, vat };
}

function settlementsFromNode(node: XmlNode | undefined): Invoice["settlements"] | undefined {
  if (!node) return undefined;
  const charges = findAllObjects(node, "Obciazenia").map((entry): SettlementLine => ({
    type: "charge",
    amount: optionalNumber(findValue(entry, "Kwota")),
    reason: text(findValue(entry, "Powod")) || undefined
  }));
  const deductions = findAllObjects(node, "Odliczenia").map((entry): SettlementLine => ({
    type: "deduction",
    amount: optionalNumber(findValue(entry, "Kwota")),
    reason: text(findValue(entry, "Powod")) || undefined
  }));
  const settlements = {
    charges,
    deductions,
    totalCharges: optionalNumber(findValue(node, "SumaObciazen")),
    totalDeductions: optionalNumber(findValue(node, "SumaOdliczen")),
    amountToSettle: optionalNumber(findValue(node, "DoRozliczenia"))
  };
  return charges.length || deductions.length || settlements.totalCharges || settlements.totalDeductions || settlements.amountToSettle
    ? settlements
    : undefined;
}

function ordersFromNode(fa: XmlNode): OrderInfo[] {
  const transactionOrders: OrderInfo[] = findAllObjects(fa, "Zamowienia").map((entry) => ({
    orderNumber: text(findValue(entry, "NrZamowienia")) || undefined,
    contractNumber: text(findValue(entry, "NrUmowy")) || undefined
  }));
  const advanceOrders: OrderInfo[] = findAllObjects(fa, "Zamowienie").map((entry) => ({
    orderNumber: text(findValue(entry, "NrZamowienia")) || undefined,
    contractNumber: text(findValue(entry, "NrUmowy")) || undefined,
    totalValue: optionalNumber(findValue(entry, "WartoscZamowienia")),
    lines: findAllObjects(entry, "ZamowienieWiersz").map(orderLineFromNode)
  }));
  return [...transactionOrders, ...advanceOrders].filter(
    (order) => order.orderNumber || order.contractNumber || order.totalValue || order.lines?.length
  );
}

function orderLineFromNode(node: XmlNode): OrderLine {
  return {
    lineNumber: text(findValue(node, "NrWierszaZam")) || undefined,
    index: text(firstDefined(findValue(node, "IndeksZ"), findValue(node, "GTINZ"), findValue(node, "PKWiUZ"), findValue(node, "CNZ"))) || undefined,
    name: text(findValue(node, "P_7Z")) || undefined,
    quantity: optionalNumber(findValue(node, "P_8BZ")),
    unit: text(findValue(node, "P_8AZ")) || undefined,
    unitPrice: optionalNumber(findValue(node, "P_9AZ")),
    netValue: optionalNumber(findValue(node, "P_11NettoZ")),
    vatValue: optionalNumber(findValue(node, "P_11VatZ")),
    vatRate: text(findValue(node, "P_12Z")) || undefined
  };
}

function itemsFromOrderLines(orders: OrderInfo[]): InvoiceItem[] {
  return orders
    .flatMap((order) => order.lines ?? [])
    .filter((line) => line.name || line.netValue !== undefined)
    .map((line, index) => {
      const net = line.netValue ?? 0;
      const vat = line.vatValue ?? 0;
      return {
        index: line.index,
        name: line.name || `Order item ${index + 1}`,
        quantity: line.quantity ?? 1,
        unit: line.unit,
        unitPrice: line.unitPrice ?? net,
        netValue: net,
        vatRate: line.vatRate ?? "0",
        grossValue: net + vat
      };
    });
}

function partyOrUndefined(node: XmlNode | undefined) {
  if (!node) return undefined;
  const party = partyFromNode(node);
  return party.name === "Unknown party" && !party.vatId && !party.address ? undefined : party;
}

function totalsFromLineItems(items: InvoiceItem[]) {
  const net = items.reduce((sum, item) => sum + item.netValue, 0);
  const gross = items.reduce((sum, item) => sum + item.grossValue, 0);
  return { net, vat: gross - net, gross };
}

function buildWarnings(invoice: Invoice, usedOrderLinesAsItems = false) {
  const warnings: string[] = [];
  if (!invoice.items.length) warnings.push("No line items were found in the XML.");
  if (usedOrderLinesAsItems) {
    warnings.push("No FaWiersz line items were found; the item table is populated from ZamowienieWiersz order lines.");
  }
  if (!invoice.issueDate) warnings.push("Issue date is missing.");
  if (invoice.invoiceNumber === "UNKNOWN") warnings.push("Invoice number is missing.");
  if (!invoice.taxBreakdown?.length) warnings.push("No FA(3) tax summary fields were found; totals are calculated from line items.");
  return warnings;
}

function getPath(node: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => (isObject(current) ? current[key] : undefined), node);
}

function pickObject(node: unknown, keys: string[]): XmlNode | undefined {
  if (!isObject(node)) return undefined;
  for (const key of keys) {
    const value = node[key];
    if (isObject(value)) return value as XmlNode;
  }
  for (const child of Object.values(node)) {
    if (isObject(child)) {
      const found = pickObject(child, keys);
      if (found) return found;
    }
  }
  return undefined;
}

function findValue(node: unknown, key: string): unknown {
  if (!isObject(node)) return undefined;
  if (key in node) return node[key];
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = findValue(entry, key);
        if (found !== undefined) return found;
      }
    } else if (isObject(value)) {
      const found = findValue(value, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function findAllObjects(node: unknown, key: string): XmlNode[] {
  if (!isObject(node)) return [];
  const direct = node[key];
  const matches = Array.isArray(direct) ? direct.filter(isObject) : isObject(direct) ? [direct] : [];
  return [
    ...(matches as XmlNode[]),
    ...Object.values(node).flatMap((value) =>
      Array.isArray(value) ? value.flatMap((entry) => findAllObjects(entry, key)) : findAllObjects(value, key)
    )
  ];
}

function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function paymentMethodLabel(code: string) {
  return getPaymentMethodLabel(code, "en")?.toLowerCase();
}

function invoiceTypeLabel(code: string) {
  const labels: Record<string, string> = {
    VAT: "Basic invoice",
    ZAL: "Advance invoice",
    ROZ: "Final settlement invoice",
    KOR: "Corrective invoice",
    KOR_ZAL: "Corrective advance invoice",
    KOR_ROZ: "Corrective final settlement invoice",
    UPR: "Simplified invoice"
  };
  return labels[code];
}

function joinCompact(values: string[]) {
  return values.filter(Boolean).join("");
}

function text(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return "";
  return String(value).trim();
}

function getPrimitive(value: unknown) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : undefined;
}

function numberFrom(value: unknown, fallback: number) {
  const normalized = text(value).replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown) {
  const parsed = numberFrom(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isObject(value: unknown): value is XmlNode {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
