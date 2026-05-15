import type { LanguageCode } from "@/types/invoice";

export type PaymentMethodCode = "1" | "2" | "3" | "4" | "5" | "6" | "7";

export const PAYMENT_METHOD_OFFICIAL_KEYS: Record<PaymentMethodCode, string> = {
  "1": "const.fa.cash",
  "2": "const.fa.card",
  "3": "const.fa.voucher",
  "4": "const.fa.check",
  "5": "const.fa.credit",
  "6": "const.fa.transfer",
  "7": "const.fa.mobile"
};

export const PAYMENT_METHOD_LABELS: Record<LanguageCode | "pl", Record<PaymentMethodCode, string>> = {
  pl: {
    "1": "Gotówka",
    "2": "Karta",
    "3": "Bon",
    "4": "Czek",
    "5": "Kredyt",
    "6": "Przelew",
    "7": "Mobilna"
  },
  en: {
    "1": "Cash",
    "2": "Card",
    "3": "Voucher",
    "4": "Cheque",
    "5": "Credit",
    "6": "Bank transfer",
    "7": "Mobile payment"
  },
  de: {
    "1": "Bargeld",
    "2": "Karte",
    "3": "Gutschein",
    "4": "Scheck",
    "5": "Kredit",
    "6": "Überweisung",
    "7": "Mobile Zahlung"
  },
  fr: {
    "1": "Espèces",
    "2": "Carte",
    "3": "Bon",
    "4": "Chèque",
    "5": "Crédit",
    "6": "Virement",
    "7": "Paiement mobile"
  },
  es: {
    "1": "Efectivo",
    "2": "Tarjeta",
    "3": "Vale",
    "4": "Cheque",
    "5": "Crédito",
    "6": "Transferencia",
    "7": "Pago móvil"
  },
  it: {
    "1": "Contanti",
    "2": "Carta",
    "3": "Buono",
    "4": "Assegno",
    "5": "Credito",
    "6": "Bonifico",
    "7": "Pagamento mobile"
  },
  nl: {
    "1": "Contant",
    "2": "Kaart",
    "3": "Voucher",
    "4": "Cheque",
    "5": "Krediet",
    "6": "Overboeking",
    "7": "Mobiele betaling"
  },
  pt: {
    "1": "Dinheiro",
    "2": "Cartão",
    "3": "Vale",
    "4": "Cheque",
    "5": "Crédito",
    "6": "Transferência",
    "7": "Pagamento móvel"
  },
  cs: {
    "1": "Hotovost",
    "2": "Karta",
    "3": "Poukaz",
    "4": "Šek",
    "5": "Úvěr",
    "6": "Bankovní převod",
    "7": "Mobilní platba"
  },
  sk: {
    "1": "Hotovosť",
    "2": "Karta",
    "3": "Poukaz",
    "4": "Šek",
    "5": "Úver",
    "6": "Bankový prevod",
    "7": "Mobilná platba"
  },
  hu: {
    "1": "Készpénz",
    "2": "Kártya",
    "3": "Utalvány",
    "4": "Csekk",
    "5": "Hitel",
    "6": "Átutalás",
    "7": "Mobilfizetés"
  },
  ro: {
    "1": "Numerar",
    "2": "Card",
    "3": "Voucher",
    "4": "Cec",
    "5": "Credit",
    "6": "Transfer bancar",
    "7": "Plată mobilă"
  },
  bg: {
    "1": "В брой",
    "2": "Карта",
    "3": "Ваучер",
    "4": "Чек",
    "5": "Кредит",
    "6": "Банков превод",
    "7": "Мобилно плащане"
  },
  hr: {
    "1": "Gotovina",
    "2": "Kartica",
    "3": "Vaučer",
    "4": "Ček",
    "5": "Kredit",
    "6": "Bankovni prijenos",
    "7": "Mobilno plaćanje"
  },
  sl: {
    "1": "Gotovina",
    "2": "Kartica",
    "3": "Bon",
    "4": "Ček",
    "5": "Kredit",
    "6": "Bančno nakazilo",
    "7": "Mobilno plačilo"
  },
  lt: {
    "1": "Grynieji",
    "2": "Kortelė",
    "3": "Kuponas",
    "4": "Čekis",
    "5": "Kreditas",
    "6": "Bankinis pavedimas",
    "7": "Mobilusis mokėjimas"
  },
  lv: {
    "1": "Skaidra nauda",
    "2": "Karte",
    "3": "Vaučers",
    "4": "Čeks",
    "5": "Kredīts",
    "6": "Bankas pārskaitījums",
    "7": "Mobilais maksājums"
  },
  et: {
    "1": "Sularaha",
    "2": "Kaart",
    "3": "Voucher",
    "4": "Tšekk",
    "5": "Krediit",
    "6": "Pangaülekanne",
    "7": "Mobiilimakse"
  },
  da: {
    "1": "Kontant",
    "2": "Kort",
    "3": "Voucher",
    "4": "Check",
    "5": "Kredit",
    "6": "Bankoverførsel",
    "7": "Mobilbetaling"
  },
  sv: {
    "1": "Kontant",
    "2": "Kort",
    "3": "Värdebevis",
    "4": "Check",
    "5": "Kredit",
    "6": "Banköverföring",
    "7": "Mobilbetalning"
  },
  fi: {
    "1": "Käteinen",
    "2": "Kortti",
    "3": "Maksukuponki",
    "4": "Sekki",
    "5": "Luotto",
    "6": "Pankkisiirto",
    "7": "Mobiilimaksu"
  },
  no: {
    "1": "Kontanter",
    "2": "Kort",
    "3": "Kupong",
    "4": "Sjekk",
    "5": "Kreditt",
    "6": "Bankoverføring",
    "7": "Mobilbetaling"
  },
  el: {
    "1": "Μετρητά",
    "2": "Κάρτα",
    "3": "Κουπόνι",
    "4": "Επιταγή",
    "5": "Πίστωση",
    "6": "Τραπεζική μεταφορά",
    "7": "Πληρωμή μέσω κινητού"
  }
};

export function getPaymentMethodLabel(code: string | undefined, language: LanguageCode | "pl") {
  const normalized = normalizePaymentMethodCode(code);
  return normalized ? PAYMENT_METHOD_LABELS[language][normalized] : undefined;
}

export function isPaymentMethodCode(code: string | undefined): code is PaymentMethodCode {
  return code === "1" || code === "2" || code === "3" || code === "4" || code === "5" || code === "6" || code === "7";
}

export function normalizePaymentMethodCode(value: string | undefined) {
  if (!value) return undefined;
  if (isPaymentMethodCode(value)) return value;

  const source = value.toLowerCase();
  if (/cash|got[oó]w/.test(source)) return "1";
  if (/card|kart/.test(source)) return "2";
  if (/voucher|bon/.test(source)) return "3";
  if (/cheque|check|czek/.test(source)) return "4";
  if (/credit|kredyt/.test(source)) return "5";
  if (/transfer|przelew|bank/.test(source)) return "6";
  if (/mobile|mobil/.test(source)) return "7";
  return undefined;
}
