import type { AdditionalDescription, BankAccount, Invoice, InvoiceItem, TaxBreakdownLine } from "@/types/invoice";

const FA3_NAMESPACE = "http://crd.gov.pl/wzor/2025/06/25/13775/";
const XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance";
const SCHEMA_LOCATION = `${FA3_NAMESPACE} ${FA3_NAMESPACE}schemat.xsd`;

export function buildSyntheticFa3Xml(invoice: Invoice) {
  const parts = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<Faktura xmlns="${FA3_NAMESPACE}" xmlns:xsi="${XSI_NAMESPACE}" xsi:schemaLocation="${escapeAttribute(SCHEMA_LOCATION)}">`,
    renderHeader(),
    renderParty("Podmiot1", invoice.seller),
    renderParty("Podmiot2", invoice.buyer),
    renderFa(invoice),
    renderFooter(invoice),
    `</Faktura>`
  ];

  return parts.filter(Boolean).join("");
}

function renderHeader() {
  return [
    "<Naglowek>",
    `<KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>`,
    "<WariantFormularza>3</WariantFormularza>",
    `<DataWytworzeniaFa>${text(new Date().toISOString().replace(/\.\d{3}Z$/, "Z"))}</DataWytworzeniaFa>`,
    "<SystemInfo>KSeF Invoice Translator PDF reconstruction</SystemInfo>",
    "</Naglowek>"
  ].join("");
}

function renderParty(tag: "Podmiot1" | "Podmiot2", party: Invoice["seller"]) {
  return [
    `<${tag}>`,
    "<DaneIdentyfikacyjne>",
    renderVatId(party.vatId),
    `<Nazwa>${text(party.name)}</Nazwa>`,
    "</DaneIdentyfikacyjne>",
    renderAddress(party.address),
    tag === "Podmiot2" ? "<JST>2</JST><GV>2</GV>" : "",
    `</${tag}>`
  ].join("");
}

function renderVatId(vatId: string | undefined) {
  const normalized = (vatId ?? "").replace(/\s+/g, "");
  const euVat = normalized.match(/^([A-Z]{2})(.+)$/);
  if (euVat && euVat[1] !== "PL") {
    return `<KodUE>${text(euVat[1])}</KodUE><NrVatUE>${text(euVat[2])}</NrVatUE>`;
  }
  return `<NIP>${text(normalized.replace(/^PL/i, "") || "0000000000")}</NIP>`;
}

function renderAddress(address: string | undefined) {
  const lines = splitAddress(address);
  return [
    "<Adres>",
    "<KodKraju>PL</KodKraju>",
    `<AdresL1>${text(lines[0] || "-")}</AdresL1>`,
    lines[1] ? `<AdresL2>${text(lines[1])}</AdresL2>` : "",
    "</Adres>"
  ].join("");
}

function splitAddress(address: string | undefined) {
  const clean = (address ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return ["-"];
  const parts = clean.split(/\s*,\s*/).filter(Boolean);
  if (parts.length <= 1) return [clean];
  return [parts.slice(0, -1).join(", "), parts[parts.length - 1]];
}

function renderFa(invoice: Invoice) {
  return [
    "<Fa>",
    `<KodWaluty>${text(invoice.currency || "PLN")}</KodWaluty>`,
    `<P_1>${text(invoice.issueDate)}</P_1>`,
    `<P_2>${text(invoice.invoiceNumber)}</P_2>`,
    invoice.saleDate ? `<P_6>${text(invoice.saleDate)}</P_6>` : "",
    renderTaxSummary(invoice),
    `<P_15>${amount(invoice.totals.gross)}</P_15>`,
    renderAnnotations(invoice),
    `<RodzajFaktury>${text(invoice.invoiceType || "VAT")}</RodzajFaktury>`,
    renderAdditionalDescriptions(invoice.additionalDescriptions),
    renderAdvanceInvoiceReferences(invoice),
    invoice.items.map(renderItem).join(""),
    renderPayment(invoice),
    renderTransactionTerms(invoice),
    "</Fa>"
  ].join("");
}

function renderTaxSummary(invoice: Invoice) {
  const lines = invoice.taxBreakdown?.length ? invoice.taxBreakdown : taxBreakdownFromItems(invoice.items);
  const byCode = new Map(lines.map((line) => [normalizeTaxCode(line), line]));
  const basic = byCode.get("1") ?? byCode.get("23") ?? byCode.get("22");
  const reduced8 = byCode.get("2") ?? byCode.get("8") ?? byCode.get("7");
  const reduced5 = byCode.get("3") ?? byCode.get("5");
  const zero = byCode.get("6_1") ?? byCode.get("0");
  const exempt = byCode.get("7") ?? byCode.get("zw");
  const outside = byCode.get("8") ?? byCode.get("np");

  return [
    renderTaxLine("P_13_1", "P_14_1", "P_14_1W", basic),
    renderTaxLine("P_13_2", "P_14_2", "P_14_2W", reduced8),
    renderTaxLine("P_13_3", "P_14_3", undefined, reduced5),
    zero?.net !== undefined ? `<P_13_6_1>${amount(zero.net)}</P_13_6_1>` : "",
    exempt?.net !== undefined ? `<P_13_7>${amount(exempt.net)}</P_13_7>` : "",
    outside?.net !== undefined ? `<P_13_8>${amount(outside.net)}</P_13_8>` : ""
  ].join("");
}

function renderTaxLine(netKey: string, vatKey: string, vatPlnKey: string | undefined, line: TaxBreakdownLine | undefined) {
  if (!line) return "";
  return [
    line.net !== undefined ? `<${netKey}>${amount(line.net)}</${netKey}>` : "",
    line.vat !== undefined ? `<${vatKey}>${amount(line.vat)}</${vatKey}>` : "",
    vatPlnKey && line.vatInPln !== undefined ? `<${vatPlnKey}>${amount(line.vatInPln)}</${vatPlnKey}>` : ""
  ].join("");
}

function renderAnnotations(invoice: Invoice) {
  const splitPayment = invoice.annotations?.splitPayment ? "1" : "2";
  const reverseCharge = invoice.annotations?.reverseCharge ? "1" : "2";
  return [
    "<Adnotacje>",
    `<P_16>${invoice.annotations?.cashAccounting ? "1" : "2"}</P_16>`,
    `<P_17>${invoice.annotations?.selfBilling ? "1" : "2"}</P_17>`,
    `<P_18>${reverseCharge}</P_18>`,
    `<P_18A>${splitPayment}</P_18A>`,
    "<Zwolnienie><P_19N>1</P_19N></Zwolnienie>",
    "<NoweSrodkiTransportu><P_22N>1</P_22N></NoweSrodkiTransportu>",
    `<P_23>${invoice.annotations?.fiscalReceipt ? "1" : "2"}</P_23>`,
    "<PMarzy><P_PMarzyN>1</P_PMarzyN></PMarzy>",
    "</Adnotacje>"
  ].join("");
}

function renderAdvanceInvoiceReferences(invoice: Invoice) {
  return (invoice.details?.advanceInvoices ?? [])
    .filter((entry) => entry.ksefNumber || entry.number)
    .map((entry) => [
      "<FakturaZaliczkowa>",
      entry.ksefNumber ? `<NrKSeFFaZaliczkowej>${text(entry.ksefNumber)}</NrKSeFFaZaliczkowej>` : "",
      entry.number ? `<NrFaZaliczkowej>${text(entry.number)}</NrFaZaliczkowej>` : "",
      "</FakturaZaliczkowa>"
    ].join(""))
    .join("");
}

function renderAdditionalDescriptions(descriptions: AdditionalDescription[] | undefined) {
  return (descriptions ?? [])
    .filter((entry) => entry.value || entry.key)
    .map((entry) => [
      "<DodatkowyOpis>",
      entry.lineNumber ? `<NrWiersza>${text(entry.lineNumber)}</NrWiersza>` : "",
      entry.key ? `<Klucz>${text(entry.key)}</Klucz>` : "",
      `<Wartosc>${text(entry.value)}</Wartosc>`,
      "</DodatkowyOpis>"
    ].join(""))
    .join("");
}

function renderItem(item: InvoiceItem, index: number) {
  return [
    "<FaWiersz>",
    `<NrWierszaFa>${text(item.lineNumber || String(index + 1))}</NrWierszaFa>`,
    `<P_7>${text(item.name)}</P_7>`,
    item.index ? `<Indeks>${text(item.index)}</Indeks>` : "",
    item.unit ? `<P_8A>${text(item.unit)}</P_8A>` : "",
    `<P_8B>${amount(item.quantity)}</P_8B>`,
    `<P_9A>${amount(item.unitPrice)}</P_9A>`,
    item.grossUnitPrice !== undefined ? `<P_9B>${amount(item.grossUnitPrice)}</P_9B>` : "",
    item.discount !== undefined ? `<P_10>${amount(item.discount)}</P_10>` : "",
    `<P_11>${amount(item.netValue)}</P_11>`,
    item.vatValue !== undefined ? `<P_11Vat>${amount(item.vatValue)}</P_11Vat>` : "",
    `<P_12>${text(normalizeItemVatRate(item.vatRate))}</P_12>`,
    item.currencyRate ? `<KursWaluty>${text(item.currencyRate)}</KursWaluty>` : "",
    "</FaWiersz>"
  ].join("");
}

function renderPayment(invoice: Invoice) {
  const payment = invoice.payment;
  if (!payment) return "";
  const bankAccounts = [
    ...(payment.bankAccounts ?? []),
    ...(payment.bankAccount ? [{ accountNumber: payment.bankAccount, type: "seller" as const }] : [])
  ];
  const uniqueAccounts = uniqueBankAccounts(bankAccounts);
  return [
    "<Platnosc>",
    payment.dueDate ? `<TerminPlatnosci><Termin>${text(payment.dueDate)}</Termin></TerminPlatnosci>` : "",
    `<FormaPlatnosci>${text(paymentMethodCode(payment.method, payment.methodLabel))}</FormaPlatnosci>`,
    uniqueAccounts.map((account) => renderBankAccount(account)).join(""),
    (payment.factorBankAccounts ?? []).map((account) => renderBankAccount(account, "RachunekBankowyFaktora")).join(""),
    "</Platnosc>"
  ].join("");
}

function renderBankAccount(account: BankAccount, tag = "RachunekBankowy") {
  return [
    `<${tag}>`,
    `<NrRB>${text(account.accountNumber)}</NrRB>`,
    account.swift ? `<SWIFT>${text(account.swift)}</SWIFT>` : "",
    account.bankName ? `<NazwaBanku>${text(account.bankName)}</NazwaBanku>` : "",
    account.description ? `<OpisRachunku>${text(account.description)}</OpisRachunku>` : "",
    `</${tag}>`
  ].join("");
}

function renderTransactionTerms(invoice: Invoice) {
  const orders = [
    ...(invoice.orders ?? []).map((order) => order.orderNumber).filter(Boolean),
    ...(invoice.transactionTerms?.orders ?? []).map((order) => order.number).filter(Boolean)
  ];
  const contracts = [
    ...(invoice.orders ?? []).map((order) => order.contractNumber).filter(Boolean),
    ...(invoice.transactionTerms?.contracts ?? []).map((contract) => contract.number).filter(Boolean)
  ];
  if (!orders.length && !contracts.length) return "";
  return [
    "<WarunkiTransakcji>",
    orders.map((orderNumber) => `<Zamowienia><NrZamowienia>${text(orderNumber)}</NrZamowienia></Zamowienia>`).join(""),
    contracts.map((contractNumber) => `<Umowy><NrUmowy>${text(contractNumber)}</NrUmowy></Umowy>`).join(""),
    "</WarunkiTransakcji>"
  ].join("");
}

function renderFooter(invoice: Invoice) {
  const footer = invoice.footer;
  if (!footer?.text && !footer?.registry) return "";
  return [
    "<Stopka>",
    footer.text ? `<Informacje><StopkaFaktury>${text(footer.text)}</StopkaFaktury></Informacje>` : "",
    footer.registry
      ? [
          "<Rejestry>",
          footer.registry.fullName ? `<PelnaNazwa>${text(footer.registry.fullName)}</PelnaNazwa>` : "",
          footer.registry.krs ? `<KRS>${text(footer.registry.krs)}</KRS>` : "",
          footer.registry.regon ? `<REGON>${text(footer.registry.regon)}</REGON>` : "",
          footer.registry.bdo ? `<BDO>${text(footer.registry.bdo)}</BDO>` : "",
          "</Rejestry>"
        ].join("")
      : "",
    "</Stopka>"
  ].join("");
}

function taxBreakdownFromItems(items: InvoiceItem[]): TaxBreakdownLine[] {
  const grouped = new Map<string, TaxBreakdownLine>();
  items.forEach((item) => {
    const code = normalizeItemVatRate(item.vatRate);
    const existing = grouped.get(code) ?? { code, label: code, net: 0, vat: 0 };
    existing.net = (existing.net ?? 0) + item.netValue;
    existing.vat = (existing.vat ?? 0) + (item.vatValue ?? item.grossValue - item.netValue);
    grouped.set(code, existing);
  });
  return [...grouped.values()];
}

function normalizeTaxCode(line: TaxBreakdownLine) {
  const source = `${line.code} ${line.label}`.toLowerCase();
  if (line.code === "1" || /23|22|basic/.test(source)) return "1";
  if (line.code === "2" || /8|7|reduced/.test(source)) return "2";
  if (line.code === "3" || /5/.test(source)) return "3";
  if (/^0$|0%/.test(source)) return "0";
  if (/zw|exempt/.test(source)) return "zw";
  if (/np|outside/.test(source)) return "np";
  return line.code;
}

function normalizeItemVatRate(value: string) {
  const trimmed = value.trim();
  if (/zw/i.test(trimmed)) return "zw";
  if (/np/i.test(trimmed)) return "np";
  return trimmed.replace("%", "").replace(",", ".");
}

function paymentMethodCode(method: string | undefined, label: string | undefined) {
  const source = `${method ?? ""} ${label ?? ""}`.toLowerCase();
  if (/cash|got[oó]w/.test(source)) return "1";
  if (/card|kart/.test(source)) return "2";
  if (/voucher|bon/.test(source)) return "3";
  if (/cheque|czek/.test(source)) return "4";
  if (/credit|kredyt/.test(source)) return "5";
  if (/transfer|przelew|bank/.test(source)) return "6";
  if (/mobile|mobil/.test(source)) return "7";
  return method && /^[1-7]$/.test(method) ? method : "6";
}

function uniqueBankAccounts(accounts: BankAccount[]) {
  const seen = new Set<string>();
  return accounts.filter((account) => {
    if (seen.has(account.accountNumber)) return false;
    seen.add(account.accountNumber);
    return true;
  });
}

function amount(value: number | undefined) {
  const numeric = Number.isFinite(value) ? value ?? 0 : 0;
  return String(Math.round(numeric * 100) / 100);
}

function text(value: string | number | undefined) {
  return escapeText(String(value ?? ""));
}

function escapeText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string) {
  return escapeText(value).replace(/"/g, "&quot;");
}
