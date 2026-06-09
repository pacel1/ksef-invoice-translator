/**
 * Data for the animated hero invoice (InvoiceShowcase). The card cycles these
 * six languages to demonstrate translation. Translatable strings live per
 * language; the numbers/IDs/amounts (SHOWCASE_FIXED) never change, which is
 * the whole point. Currency localizes zł -> PLN (the value does not change).
 * Locale-independent: shown identically on the pl and en pages.
 */
export type ShowcaseCode = "PL" | "EN" | "DE" | "FR" | "ES" | "IT";

export interface ShowcaseLang {
  title: string;
  number: string;
  issue: string;
  buyer: string;
  nip: string;
  item: string;
  total: string;
  cur: string;
  lock: string;
  status: string;
}

export const SHOWCASE_ORDER: ShowcaseCode[] = ["PL", "EN", "DE", "FR", "ES", "IT"];

export const SHOWCASE_LANGS: Record<ShowcaseCode, ShowcaseLang> = {
  PL: { title: "FAKTURA", number: "Numer", issue: "Data wystawienia", buyer: "Nabywca", nip: "NIP sprzedawcy", item: "Usługa konsultingowa", total: "Razem do zapłaty", cur: "zł", lock: "Numery, kwoty i kod QR bez zmian", status: "Gotowe" },
  EN: { title: "INVOICE", number: "Number", issue: "Issue date", buyer: "Buyer", nip: "Seller VAT ID", item: "Consulting service", total: "Total due", cur: "PLN", lock: "Numbers, amounts and QR unchanged", status: "Translated" },
  DE: { title: "RECHNUNG", number: "Nummer", issue: "Ausstellungsdatum", buyer: "Käufer", nip: "USt-IdNr. des Verkäufers", item: "Beratungsleistung", total: "Fälliger Betrag", cur: "PLN", lock: "Nummern, Beträge und QR unverändert", status: "Übersetzt" },
  FR: { title: "FACTURE", number: "Numéro", issue: "Date d'émission", buyer: "Acheteur", nip: "N° TVA du vendeur", item: "Service de conseil", total: "Total à payer", cur: "PLN", lock: "Numéros, montants et QR inchangés", status: "Traduit" },
  ES: { title: "FACTURA", number: "Número", issue: "Fecha de emisión", buyer: "Comprador", nip: "NIF del vendedor", item: "Servicio de consultoría", total: "Total a pagar", cur: "PLN", lock: "Números, importes y QR sin cambios", status: "Traducido" },
  IT: { title: "FATTURA", number: "Numero", issue: "Data di emissione", buyer: "Acquirente", nip: "P. IVA del venditore", item: "Servizio di consulenza", total: "Totale da pagare", cur: "PLN", lock: "Numeri, importi e QR invariati", status: "Tradotto" }
};

/** Locked values that never change as the language cycles. */
export const SHOWCASE_FIXED = {
  seller: "ACME Sp. z o.o.",
  number: "FV 2026/04/118",
  issue: "12.04.2026",
  buyer: "Globex GmbH",
  nip: "701-000-12-34",
  itemAmount: "10 000,00",
  total: "12 300,00"
} as const;

export const SHOWCASE_CYCLE_MS = 2400;
