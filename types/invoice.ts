export type InvoiceParty = {
  name: string;
  vatId?: string;
  address?: string;
  role?: string;
  customerNumber?: string;
};

export type InvoiceItem = {
  index?: string;
  name: string;
  translatedName?: string;
  quantity: number;
  unit?: string;
  translatedUnit?: string;
  unitPrice: number;
  netValue: number;
  vatRate: string;
  grossValue: number;
};

export type BankAccount = {
  accountNumber: string;
  swift?: string;
  bankName?: string;
  description?: string;
  type?: "seller" | "factor";
};

export type PaymentTerm = {
  dueDate?: string;
  description?: string;
};

export type PartialPayment = {
  amount?: number;
  date?: string;
  method?: string;
  otherMethodDescription?: string;
};

export type DiscountTerm = {
  conditions?: string;
  amount?: number;
};

export type TaxBreakdownLine = {
  code: string;
  label: string;
  net?: number;
  vat?: number;
  vatInPln?: number;
};

export type AdditionalDescription = {
  lineNumber?: string;
  key?: string;
  value: string;
  translatedKey?: string;
  translatedValue?: string;
};

export type SettlementLine = {
  type: "charge" | "deduction";
  amount?: number;
  reason?: string;
  translatedReason?: string;
};

export type OrderLine = {
  lineNumber?: string;
  index?: string;
  name?: string;
  translatedName?: string;
  quantity?: number;
  unit?: string;
  translatedUnit?: string;
  unitPrice?: number;
  netValue?: number;
  vatValue?: number;
  vatRate?: string;
};

export type OrderInfo = {
  orderNumber?: string;
  contractNumber?: string;
  totalValue?: number;
  lines?: OrderLine[];
};

export type InvoiceFooter = {
  text?: string;
  translatedText?: string;
  registry?: {
    fullName?: string;
    krs?: string;
    regon?: string;
    bdo?: string;
  };
};

export type Invoice = {
  invoiceNumber: string;
  invoiceType?: string;
  invoiceTypeLabel?: string;
  issueDate: string;
  saleDate?: string;
  currency: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  items: InvoiceItem[];
  totals: {
    net: number;
    vat: number;
    gross: number;
  };
  payment?: {
    dueDate?: string;
    method?: string;
    methodLabel?: string;
    isPaid?: string;
    paidDate?: string;
    otherMethodDescription?: string;
    bankAccount?: string;
    bankAccounts?: BankAccount[];
    factorBankAccounts?: BankAccount[];
    paymentTerms?: PaymentTerm[];
    partialPayments?: PartialPayment[];
    discounts?: DiscountTerm[];
    paymentLink?: string;
    ipKsef?: string;
  };
  taxBreakdown?: TaxBreakdownLine[];
  additionalDescriptions?: AdditionalDescription[];
  thirdParties?: InvoiceParty[];
  authorizedParty?: InvoiceParty;
  settlements?: {
    charges?: SettlementLine[];
    deductions?: SettlementLine[];
    totalCharges?: number;
    totalDeductions?: number;
    amountToSettle?: number;
  };
  orders?: OrderInfo[];
  verification?: {
    ksefNumber?: string;
    qrLink?: string;
  };
  notes?: string;
  translatedNotes?: string;
  footer?: InvoiceFooter;
};

export type LanguageCode =
  | "en"
  | "de"
  | "fr"
  | "es"
  | "it"
  | "nl"
  | "pt"
  | "cs"
  | "sk"
  | "hu"
  | "ro"
  | "bg"
  | "hr"
  | "sl"
  | "lt"
  | "lv"
  | "et"
  | "da"
  | "sv"
  | "fi"
  | "no"
  | "el";

export type TranslationLabels = Record<string, string>;

export type TranslatedInvoice = Invoice & {
  language: LanguageCode;
};
