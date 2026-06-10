import type { Invoice } from "@/types/invoice";

/**
 * Static data for the landing live demo (Lane 1). The base invoice drives the
 * on screen preview; per language overlays carry only the translated free text
 * (item names, units, the 0% WDT legal note, footer text). Structural labels are
 * localized by InvoicePreview itself via getLabels(language), so they are not baked
 * here. Numbers, IDs, IBAN, dates and the KSeF id never change between languages.
 */
export type DemoLang = "en" | "de" | "fr" | "es" | "it" | "cs";

export const DEMO_LANGS: { code: DemoLang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
  { code: "fr", label: "FR" },
  { code: "es", label: "ES" },
  { code: "it", label: "IT" },
  { code: "cs", label: "CS" }
];

export const DEMO_DEFAULT_LANG: DemoLang = "en";

/** Polish source invoice, hand authored to the Invoice type, untranslated. */
export const DEMO_SAMPLE_INVOICE: Invoice = {
  invoiceNumber: "FV 2026/05/0142",
  invoiceType: "VAT",
  invoiceTypeLabel: "Faktura podstawowa",
  issueDate: "2026-05-12",
  saleDate: "2026-05-12",
  currency: "EUR",
  seller: {
    name: "Meble Dębowe Nowak Sp. z o.o.",
    vatId: "7811924552",
    address: "ul. Przemysłowa 14, 61-001 Poznań, PL"
  },
  buyer: {
    name: "Holzkontor Brandt GmbH",
    vatId: "DE811569244",
    address: "Chausseestraße 22, 10115 Berlin, DE"
  },
  items: [
    { name: "Stół dębowy „Helena” 180 cm", quantity: 12, unit: "szt", unitPrice: 420, netValue: 5040, vatRate: "0", grossValue: 5040 },
    { name: "Krzesło dębowe „Helena”", quantity: 48, unit: "szt", unitPrice: 95, netValue: 4560, vatRate: "0", grossValue: 4560 },
    { name: "Transport i pakowanie", quantity: 1, unit: "usł", unitPrice: 600, netValue: 600, vatRate: "0", grossValue: 600 }
  ],
  totals: { net: 10200, vat: 0, gross: 10200 },
  payment: {
    dueDate: "2026-05-26",
    status: "unpaid",
    bankAccounts: [
      { accountNumber: "PL61 1090 1014 0000 0712 1981 2874", bankName: "Santander Bank Polska", swift: "WBKPPLPP" }
    ]
  },
  additionalDescriptions: [
    { key: "Podstawa zastosowania stawki 0%", value: "Wewnątrzwspólnotowa dostawa towarów, stawka 0% (art. 42 ust. 1 ustawy o VAT)" }
  ],
  footer: {
    text: "Kapitał zakładowy 200 000 zł",
    registry: { fullName: "Meble Dębowe Nowak Sp. z o.o.", krs: "0000412857", regon: "302419774", bdo: "000158472" }
  },
  verification: {
    ksefNumber: "7811924552-20260512-FA1A2B3C4D5E-7F",
    qrLink: "https://ksef.mf.gov.pl/web/verify/7811924552-20260512-FA1A2B3C4D5E-7F"
  }
};

interface DemoOverlay {
  itemNames: [string, string, string];
  itemUnits: [string, string, string];
  noteKey: string;
  noteValue: string;
  footerText: string;
}

const DEMO_OVERLAYS: Record<DemoLang, DemoOverlay> = {
  en: {
    itemNames: ["Oak dining table „Helena” 180 cm", "Oak chair „Helena”", "Delivery and packaging"],
    itemUnits: ["pcs", "pcs", "svc"],
    noteKey: "Basis for applying the 0% rate",
    noteValue: "Intra-Community supply of goods, 0% rate (Art. 42(1) of the VAT Act)",
    footerText: "Share capital PLN 200,000"
  },
  de: {
    itemNames: ["Eichen-Esstisch „Helena” 180 cm", "Eichenstuhl „Helena”", "Lieferung und Verpackung"],
    itemUnits: ["Stk", "Stk", "Lstg."],
    noteKey: "Grundlage für die Anwendung des Nullsatzes",
    noteValue: "Innergemeinschaftliche Lieferung von Gegenständen, 0%-Satz (Art. 42 Abs. 1 des poln. UStG)",
    footerText: "Stammkapital 200.000 PLN"
  },
  fr: {
    itemNames: ["Table à manger en chêne « Helena » 180 cm", "Chaise en chêne « Helena »", "Livraison et emballage"],
    itemUnits: ["pce", "pce", "prest."],
    noteKey: "Base d'application du taux de 0 %",
    noteValue: "Livraison intracommunautaire de biens, taux de 0 % (art. 42 al. 1 de la loi sur la TVA)",
    footerText: "Capital social 200 000 PLN"
  },
  es: {
    itemNames: ["Mesa de comedor de roble «Helena» 180 cm", "Silla de roble «Helena»", "Entrega y embalaje"],
    itemUnits: ["uds", "uds", "serv."],
    noteKey: "Base para aplicar el tipo del 0%",
    noteValue: "Entrega intracomunitaria de bienes, tipo del 0% (art. 42.1 de la Ley del IVA)",
    footerText: "Capital social 200 000 PLN"
  },
  it: {
    itemNames: ["Tavolo da pranzo in rovere “Helena” 180 cm", "Sedia in rovere “Helena”", "Consegna e imballaggio"],
    itemUnits: ["pz", "pz", "serv."],
    noteKey: "Base per l'applicazione dell'aliquota 0%",
    noteValue: "Cessione intracomunitaria di beni, aliquota 0% (art. 42 c. 1 della legge IVA)",
    footerText: "Capitale sociale 200.000 PLN"
  },
  cs: {
    itemNames: ["Dubový jídelní stůl „Helena” 180 cm", "Dubová židle „Helena”", "Doprava a balení"],
    itemUnits: ["ks", "ks", "sl."],
    noteKey: "Důvod použití nulové sazby",
    noteValue: "Dodání zboží do jiného členského státu, sazba 0 % (čl. 42 odst. 1 zákona o DPH)",
    footerText: "Základní kapitál 200 000 PLN"
  }
};

/** Returns a new Invoice with free text translated for the language. Never mutates the base. */
export function buildDemoInvoice(lang: DemoLang): Invoice {
  const o = DEMO_OVERLAYS[lang];
  return {
    ...DEMO_SAMPLE_INVOICE,
    items: DEMO_SAMPLE_INVOICE.items.map((item, i) => ({
      ...item,
      translatedName: o.itemNames[i],
      translatedUnit: o.itemUnits[i]
    })),
    additionalDescriptions: DEMO_SAMPLE_INVOICE.additionalDescriptions?.map((d) => ({
      ...d,
      translatedKey: o.noteKey,
      translatedValue: o.noteValue
    })),
    footer: DEMO_SAMPLE_INVOICE.footer
      ? { ...DEMO_SAMPLE_INVOICE.footer, translatedText: o.footerText }
      : undefined
  };
}
