import { XMLParser, XMLValidator } from "fast-xml-parser";
import type {
  AdditionalDescription,
  BankAccount,
  CorrectedInvoiceReference,
  Invoice,
  InvoiceAnnotations,
  InvoiceDetails,
  InvoiceFooter,
  InvoiceItem,
  OrderInfo,
  OrderLine,
  PaymentTerm,
  SettlementLine,
  TaxBreakdownLine,
  TransactionTerms
} from "@/types/invoice";
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
      details: detailsFromNode(fa, items),
      correction: correctionFromNode(fa),
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
      annotations: annotationsFromNode(fa),
      additionalDescriptions,
      thirdParties: findAllObjects(root, "Podmiot3").map(partyFromNode),
      authorizedParty: partyOrUndefined(pickObject(root, ["PodmiotUpowazniony"])),
      settlements: settlementsFromNode(pickObject(fa, ["Rozliczenie"])),
      orders,
      transactionTerms: transactionTermsFromNode(pickObject(fa, ["WarunkiTransakcji"])),
      warehouseDocuments: warehouseDocumentsFromNode(root),
      attachments: attachmentsFromNode(root),
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
      lineNumber: text(findValue(node, "NrWierszaFa")) || undefined,
      uniqueRowNumber: text(findValue(node, "UU_ID")) || undefined,
      index: text(findValue(node, "Indeks")) || undefined,
      name: text(firstDefined(findValue(node, "P_7"), findValue(node, "Nazwa"))) || `Invoice item ${index + 1}`,
      quantity: numberFrom(firstDefined(findValue(node, "P_8B"), findValue(node, "Ilosc")), 1),
      unit: text(firstDefined(findValue(node, "P_8A"), findValue(node, "JM"))) || undefined,
      unitPrice: numberFrom(firstDefined(findValue(node, "P_9A"), findValue(node, "CenaJednostkowa")), net),
      grossUnitPrice: optionalNumber(findValue(node, "P_9B")),
      discount: optionalNumber(findValue(node, "P_10")),
      netValue: net,
      vatRate,
      grossValue: gross,
      vatValue: optionalNumber(findValue(node, "P_11Vat")),
      ossVatRate: text(findValue(node, "P_12_XII")) || undefined,
      productMarker: text(findValue(node, "P_12_Zal_15")) || undefined,
      currencyRate: text(findValue(node, "KursWaluty")) || undefined,
      stateBefore: text(findValue(node, "StanPrzed")) || undefined,
      gtin: text(findValue(node, "GTIN")) || undefined,
      pkwiu: text(findValue(node, "PKWiU")) || undefined,
      cn: text(findValue(node, "CN")) || undefined,
      pkob: text(findValue(node, "PKOB")) || undefined,
      exciseTaxAmount: optionalNumber(findValue(node, "KwotaAkcyzy")),
      gtu: text(findValue(node, "GTU")) || undefined,
      procedure: text(findValue(node, "Procedura")) || undefined,
      receiptDate: text(findValue(node, "P_6A")) || undefined
    };
  });
}

function detailsFromNode(fa: XmlNode, items: InvoiceItem[]): InvoiceDetails | undefined {
  const currency = text(findValue(fa, "KodWaluty")) || undefined;
  const explicitCommonRate = text(findValue(fa, "KursWalutyZ")) || undefined;
  const rowRates = Array.from(new Set(items.map((item) => item.currencyRate).filter(Boolean))) as string[];
  const commonCurrencyRate = currency && currency !== "PLN" ? explicitCommonRate || (rowRates.length === 1 ? rowRates[0] : undefined) : undefined;
  const invoiceType = text(findValue(fa, "RodzajFaktury")) || undefined;
  const serviceDateKind = invoiceType === "ZAL" || invoiceType === "KOR_ZAL" ? "paymentReceived" : "deliveryOrService";
  const orderRowsHaveOss = findAllObjects(fa, "ZamowienieWiersz").some((node) => text(findValue(node, "P_12_XII")));
  const partialAdvances = findAllObjects(fa, "ZaliczkaCzesciowa")
    .map((node) => ({
      date: text(findValue(node, "P_6Z")) || undefined,
      amount: optionalNumber(findValue(node, "P_15Z")),
      currencyRate: text(findValue(node, "KursWalutyZW")) || undefined
    }))
    .filter((entry) => entry.date || entry.amount !== undefined || entry.currencyRate);
  const advanceInvoices = findAllObjects(fa, "FakturaZaliczkowa")
    .map((node) => ({
      number: text(findValue(node, "NrFaZaliczkowej")) || undefined,
      ksefNumber: text(findValue(node, "NrKSeFFaZaliczkowej")) || undefined
    }))
    .filter((entry) => entry.number || entry.ksefNumber);
  const details: InvoiceDetails = {
    issuePlace: text(findValue(fa, "P_1M")) || undefined,
    discountPeriod: text(findValue(fa, "OkresFaKorygowanej")) || undefined,
    serviceDate: text(findValue(fa, "P_6")) || undefined,
    serviceDateKind,
    serviceDateFrom: text(getPath(fa, ["OkresFa", "P_6_Od"])) || undefined,
    serviceDateTo: text(getPath(fa, ["OkresFa", "P_6_Do"])) || undefined,
    currencyCode: currency,
    commonCurrencyRate,
    commonCurrencyRateApplies: Boolean(commonCurrencyRate),
    hasOssProcedure: items.some((item) => item.ossVatRate) || orderRowsHaveOss,
    partialAdvances,
    advanceInvoices
  };
  return hasAnyValue(details) ? details : undefined;
}

function correctionFromNode(fa: XmlNode): Invoice["correction"] | undefined {
  const references = findAllObjects(fa, "DaneFaKorygowanej")
    .map((node): CorrectedInvoiceReference => ({
      issueDate: text(findValue(node, "DataWystFaKorygowanej")) || undefined,
      invoiceNumber: text(findValue(node, "NrFaKorygowanej")) || undefined,
      ksefNumber: text(findValue(node, "NrKSeFFaKorygowanej")) || undefined
    }))
    .filter((entry) => entry.issueDate || entry.invoiceNumber || entry.ksefNumber);
  const period = text(findValue(fa, "OkresFaKorygowanej")) || undefined;
  const correction = {
    correctedInvoiceNumber: text(findValue(fa, "NrFaKorygowany")) || undefined,
    reason: text(findValue(fa, "PrzyczynaKorekty")) || undefined,
    type: text(findValue(fa, "TypKorekty")) || undefined,
    period,
    isCollectiveDiscount: text(findValue(fa, "RodzajFaktury")) === "KOR" && Boolean(period),
    references
  };
  return hasAnyValue(correction) ? correction : undefined;
}

function annotationsFromNode(fa: XmlNode): InvoiceAnnotations | undefined {
  const adnotacje = pickObject(fa, ["Adnotacje"]) ?? {};
  const zwolnienie = pickObject(adnotacje, ["Zwolnienie"]) ?? {};
  const pMarzy = pickObject(adnotacje, ["PMarzy"]) ?? {};
  const noweSrodkiTransportu = pickObject(adnotacje, ["NoweSrodkiTransportu"]);
  const marginProcedure =
    flag(pMarzy, "P_PMarzy_3_1") ? "towary używane" :
    flag(pMarzy, "P_PMarzy_3_2") ? "dzieła sztuki" :
    flag(pMarzy, "P_PMarzy_2") ? "biura podróży" :
    flag(pMarzy, "P_PMarzy_3_3") ? "przedmioty kolekcjonerskie i antyki" :
    flag(pMarzy, "P_PMarzy") ? "procedura marży" :
    undefined;
  const annotations: InvoiceAnnotations = {
    splitPayment: flag(adnotacje, "P_18A") || undefined,
    cashAccounting: flag(adnotacje, "P_16") || undefined,
    reverseCharge: flag(adnotacje, "P_18") || undefined,
    selfBilling: flag(adnotacje, "P_17") || undefined,
    simplifiedTriangularProcedure: flag(adnotacje, "P_23") || undefined,
    relatedParty: flag(fa, "TP") || undefined,
    fiscalReceipt: flag(fa, "FP") || undefined,
    exciseTaxRefund: flag(fa, "ZwrotAkcyzy") || undefined,
    exemption: flag(zwolnienie, "P_19")
      ? {
          enabled: true,
          legalBasis: text(findValue(zwolnienie, "P_19A")) || undefined,
          directiveBasis: text(findValue(zwolnienie, "P_19B")) || undefined,
          otherBasis: text(findValue(zwolnienie, "P_19C")) || undefined
        }
      : undefined,
    marginProcedure,
    newTransportMeans: noweSrodkiTransportu
      ? {
          vatDocumentRequired: newTransportVat22Text(text(findValue(noweSrodkiTransportu, "P_42_5"))) || undefined,
          lines: findAllObjects(noweSrodkiTransportu, "NowySrodekTransportu")
            .map((node) => ({
              rowNumber: text(findValue(node, "P_NrWierszaNST")) || undefined,
              firstUseDate: text(findValue(node, "P_22A")) || undefined,
              description: newTransportDescription(node),
              identifier: joinCompact([
                text(findValue(node, "P_22B1")),
                text(findValue(node, "P_22B2")),
                text(findValue(node, "P_22B3")),
                text(findValue(node, "P_22B4")),
                text(findValue(node, "P_22C1")),
                text(findValue(node, "P_22D1"))
              ]) || undefined
            }))
            .filter((entry) => entry.rowNumber || entry.firstUseDate || entry.description || entry.identifier)
        }
      : undefined
  };
  return hasAnyValue(annotations) ? annotations : undefined;
}

function newTransportVat22Text(value: string) {
  if (value === "1") return "Istnieje obowiązek wystawienia dokumentu VAT-22";
  if (value === "2") return "Nie istnieje obowiązek wystawienia dokumentu VAT-22";
  return value;
}

function newTransportDescription(node: XmlNode) {
  const type =
    text(firstDefined(findValue(node, "P_22B"), findValue(node, "P_22BT"), findValue(node, "P_22B1"), findValue(node, "P_22B2"), findValue(node, "P_22B3"), findValue(node, "P_22B4")))
      ? "Dostawa dotyczy pojazdów lądowych, o których mowa w art. 2 pkt 10 lit. a ustawy"
      : text(firstDefined(findValue(node, "P_22C"), findValue(node, "P_22C1")))
        ? "Dostawa dotyczy jednostek pływających, o których mowa w art. 2 pkt 10 lit. b ustawy"
        : text(firstDefined(findValue(node, "P_22D"), findValue(node, "P_22D1")))
          ? "Dostawa dotyczy statków powietrznych, o których mowa w art. 2 pkt 10 lit. c ustawy"
          : undefined;
  return joinCompact([
    type,
    text(findValue(node, "DetailsString")),
    text(findValue(node, "P_22BT")),
    text(findValue(node, "P_22B")),
    text(findValue(node, "P_22C")),
    text(findValue(node, "P_22D"))
  ], "\n") || undefined;
}

function transactionTermsFromNode(node: XmlNode | undefined): TransactionTerms | undefined {
  if (!node) return undefined;
  const terms: TransactionTerms = {
    contracts: findAllObjects(node, "Umowy")
      .map((entry) => ({
        date: text(findValue(entry, "DataUmowy")) || undefined,
        number: text(findValue(entry, "NrUmowy")) || undefined
      }))
      .filter((entry) => entry.date || entry.number),
    orders: findAllObjects(node, "Zamowienia")
      .map((entry) => ({
        date: text(findValue(entry, "DataZamowienia")) || undefined,
        number: text(findValue(entry, "NrZamowienia")) || undefined
      }))
      .filter((entry) => entry.date || entry.number),
    contractualCurrency: text(findValue(node, "WalutaUmowna")) || undefined,
    contractualRate: text(findValue(node, "KursUmowny")) || undefined,
    batchNumbers: findAllObjects(node, "NrPartiiTowaru").map((entry) => text(getPrimitive(entry) ?? findValue(entry, "NrPartiiTowaru"))).filter(Boolean),
    deliveryTerms: text(findValue(node, "WarunkiDostawy")) || undefined,
    intermediaryDelivery: flag(node, "PodmiotPosredniczacy") || undefined,
    transports: findAllObjects(node, "Transport")
      .map((entry) => ({
        type: text(findValue(entry, "RodzajTransportu")) || (flag(entry, "TransportInny") ? "inny" : undefined),
        otherTypeDescription: text(findValue(entry, "OpisInnegoTransportu")) || undefined,
        orderNumber: text(findValue(entry, "NrZleceniaTransportu")) || undefined,
        cargoDescription: text(findValue(entry, "OpisLadunku")) || undefined,
        otherCargoDescription: text(findValue(entry, "OpisInnegoLadunku")) || undefined,
        packageUnit: text(findValue(entry, "JednostkaOpakowania")) || undefined,
        startDateTime: text(findValue(entry, "DataGodzRozpTransportu")) || undefined,
        endDateTime: text(findValue(entry, "DataGodzZakTransportu")) || undefined,
        carrier: carrierFromTransport(entry),
        vehicleNumber: text(firstDefined(findValue(entry, "NrRejestracyjny"), findValue(entry, "NrSrodkaTransportu"))) || undefined,
        description: text(firstDefined(findValue(entry, "OpisTransportu"), findValue(entry, "Opis"))) || undefined,
        shipFrom: shipmentAddressFromNode(pickObject(entry, ["WysylkaZ"])),
        shipTo: shipmentAddressFromNode(pickObject(entry, ["WysylkaDo"])),
        shipThrough: findAllObjects(entry, "WysylkaPrzez").map(shipmentAddressFromNode).filter((value): value is string => Boolean(value))
      }))
      .filter((entry) => hasAnyValue(entry))
  };
  return hasAnyValue(terms) ? terms : undefined;
}

function carrierFromTransport(node: XmlNode) {
  const carrier = pickObject(node, ["Przewoznik"]);
  if (carrier) {
    return joinCompact([
      text(findValue(carrier, "Nazwa")),
      text(findValue(carrier, "NIP")),
      text(findValue(carrier, "NrID"))
    ], " ");
  }
  return text(findValue(node, "Przewoznik")) || undefined;
}

function shipmentAddressFromNode(node: XmlNode | undefined) {
  if (!node) return undefined;
  return joinCompact([
    text(findValue(node, "AdresL1")),
    text(findValue(node, "AdresL2")),
    text(findValue(node, "KodKraju")),
    text(findValue(node, "GLN")) ? `GLN: ${text(findValue(node, "GLN"))}` : undefined
  ], "\n") || undefined;
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
  const paidMarker = text(findValue(node, "Zaplacono"));
  const partialPaymentMarker = text(findValue(node, "ZnacznikZaplatyCzesciowej"));

  const payment = {
    dueDate: firstTerm?.dueDate,
    method: methodCode || undefined,
    methodLabel: paymentMethodLabel(methodCode) || undefined,
    isPaid: paidMarker || undefined,
    status: paymentStatus(paidMarker, partialPaymentMarker),
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

function paymentStatus(paidMarker: string, partialPaymentMarker: string): NonNullable<Invoice["payment"]>["status"] {
  if (paidMarker === "1") return "paid";
  if (partialPaymentMarker === "1") return "paidInPart";
  if (partialPaymentMarker === "2") return "paidAllInParts";
  return "unpaid";
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
    ["1", "23% lub 22%", "P_13_1", "P_14_1", "P_14_1W"],
    ["2", "8% lub 7%", "P_13_2", "P_14_2", "P_14_2W"],
    ["3", "5%", "P_13_3", "P_14_3", "P_14_3W"],
    ["4", "4% lub 3%", "P_13_4", "P_14_4", "P_14_4W"],
    ["5", "OSS", "P_13_5", "P_14_5", undefined],
    ["6_1", "0% w przypadku sprzedaży towarów i świadczenia usług na terytorium kraju (z wyłączeniem WDT i eksportu)", "P_13_6_1", undefined, undefined],
    ["6_2", "0% w przypadku wewnątrzwspólnotowej dostawy towarów (WDT)", "P_13_6_2", undefined, undefined],
    ["6_3", "0% w przypadku eksportu towarów", "P_13_6_3", undefined, undefined],
    ["7", "zwolnione od podatku", "P_13_7", undefined, undefined],
    ["8", "np z wyłączeniem art. 100 ust 1 pkt 4 ustawy", "P_13_8", undefined, undefined],
    ["9", "np na podstawie art. 100 ust. 1 pkt 4 ustawy", "P_13_9", undefined, undefined],
    ["10", "odwrotne obciążenie", "P_13_10", undefined, undefined],
    ["11", "marża", "P_13_11", undefined, undefined]
  ] as const;

  return definitions
    .map(([code, label, netKey, vatKey, vatPlnKey]) => {
      const net = optionalNonZeroNumber(findValue(fa, netKey));
      const vat = vatKey ? optionalNonZeroNumber(findValue(fa, vatKey)) : undefined;
      const vatInPln = vatPlnKey ? optionalNonZeroNumber(findValue(fa, vatPlnKey)) : undefined;
      const shouldShow = net !== undefined || vat !== undefined || vatInPln !== undefined;
      return {
        code,
        label,
        net,
        vat,
        gross: net !== undefined ? net + (vat ?? 0) : undefined,
        vatInPln,
        shouldShow
      };
    })
    .filter((line) => line.shouldShow)
    .map(({ shouldShow: _shouldShow, ...line }) => line);
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
    amountToPay: optionalNumber(findValue(node, "DoZaplaty")),
    amountToSettle: optionalNumber(findValue(node, "DoRozliczenia"))
  };
  return charges.length || deductions.length || settlements.totalCharges || settlements.totalDeductions || settlements.amountToPay || settlements.amountToSettle
    ? settlements
    : undefined;
}

function warehouseDocumentsFromNode(root: XmlNode) {
  return findAllObjects(root, "WZ")
    .map((node) => ({
      number: text(firstDefined(findValue(node, "NrWZ"), findValue(node, "NumerWZ"), getPrimitive(node))) || undefined,
      date: text(firstDefined(findValue(node, "DataWZ"), findValue(node, "Data"))) || undefined
    }))
    .filter((entry) => entry.number || entry.date);
}

function attachmentsFromNode(root: XmlNode) {
  return findAllObjects(root, "Zalacznik")
    .map((node) => ({
      fileName: text(firstDefined(findValue(node, "NazwaPliku"), findValue(node, "NazwaZalacznika"), findValue(node, "Nazwa"))) || undefined,
      description: text(firstDefined(findValue(node, "OpisZalacznika"), findValue(node, "Opis"))) || undefined,
      hash: text(firstDefined(findValue(node, "HashZalacznika"), findValue(node, "Hash"), findValue(node, "SHA256"))) || undefined
    }))
    .filter((entry) => entry.fileName || entry.description || entry.hash);
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
    uniqueRowNumber: text(firstDefined(findValue(node, "UU_ID"), findValue(node, "UU_IDZ"))) || undefined,
    index: text(findValue(node, "IndeksZ")) || undefined,
    name: text(findValue(node, "P_7Z")) || undefined,
    quantity: optionalNumber(findValue(node, "P_8BZ")),
    unit: text(findValue(node, "P_8AZ")) || undefined,
    unitPrice: optionalNumber(findValue(node, "P_9AZ")),
    netValue: optionalNumber(findValue(node, "P_11NettoZ")),
    vatValue: optionalNumber(findValue(node, "P_11VatZ")),
    vatRate: text(findValue(node, "P_12Z")) || undefined,
    ossVatRate: text(findValue(node, "P_12Z_XII")) || undefined,
    productMarker: text(findValue(node, "P_12Z_Zal_15")) || undefined,
    gtin: text(findValue(node, "GTINZ")) || undefined,
    pkwiu: text(findValue(node, "PKWiUZ")) || undefined,
    cn: text(findValue(node, "CNZ")) || undefined,
    pkob: text(findValue(node, "PKOBZ")) || undefined,
    exciseTaxAmount: optionalNumber(findValue(node, "KwotaAkcyzyZ")),
    gtu: text(findValue(node, "GTUZ")) || undefined,
    procedure: text(findValue(node, "ProceduraZ")) || undefined,
    stateBefore: text(findValue(node, "StanPrzedZ")) || undefined
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
  const labels: Record<string, string> = {
    "1": "cash",
    "2": "card",
    "3": "voucher",
    "4": "cheque",
    "5": "credit",
    "6": "bank transfer",
    "7": "mobile payment"
  };
  return labels[code];
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

function joinCompact(values: Array<string | undefined>, separator = "") {
  return values.filter(Boolean).join(separator);
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

function optionalNonZeroNumber(value: unknown) {
  const parsed = optionalNumber(value);
  return parsed !== undefined && parsed !== 0 ? parsed : undefined;
}

function flag(node: unknown, key: string) {
  return text(findValue(node, key)) === "1";
}

function hasAnyValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasAnyValue);
  if (isObject(value)) return Object.values(value).some(hasAnyValue);
  return value !== undefined && value !== null && value !== "" && value !== false;
}

function isObject(value: unknown): value is XmlNode {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
