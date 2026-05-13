export type InvoiceParty = {
  name: string;
  vatId?: string;
  address?: string;
  role?: string;
  customerNumber?: string;
};

export type InvoiceItem = {
  lineNumber?: string;
  index?: string;
  uniqueRowNumber?: string;
  name: string;
  translatedName?: string;
  quantity: number;
  unit?: string;
  translatedUnit?: string;
  unitPrice: number;
  grossUnitPrice?: number;
  discount?: number;
  netValue: number;
  vatRate: string;
  grossValue: number;
  vatValue?: number;
  ossVatRate?: string;
  productMarker?: string;
  currencyRate?: string;
  stateBefore?: string;
  gtin?: string;
  pkwiu?: string;
  cn?: string;
  pkob?: string;
  exciseTaxAmount?: number;
  gtu?: string;
  procedure?: string;
  receiptDate?: string;
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
  gross?: number;
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
  uniqueRowNumber?: string;
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
  ossVatRate?: string;
  productMarker?: string;
  gtin?: string;
  pkwiu?: string;
  cn?: string;
  pkob?: string;
  exciseTaxAmount?: number;
  gtu?: string;
  procedure?: string;
  stateBefore?: string;
};

export type OrderInfo = {
  orderNumber?: string;
  contractNumber?: string;
  orderDate?: string;
  contractDate?: string;
  totalValue?: number;
  lines?: OrderLine[];
};

export type InvoiceDetails = {
  issuePlace?: string;
  discountPeriod?: string;
  serviceDate?: string;
  serviceDateKind?: "paymentReceived" | "deliveryOrService";
  serviceDateFrom?: string;
  serviceDateTo?: string;
  currencyCode?: string;
  commonCurrencyRate?: string;
  commonCurrencyRateApplies?: boolean;
  hasOssProcedure?: boolean;
  partialAdvances?: {
    date?: string;
    amount?: number;
    currencyRate?: string;
  }[];
  advanceInvoices?: {
    number?: string;
    ksefNumber?: string;
  }[];
};

export type CorrectedInvoiceReference = {
  issueDate?: string;
  invoiceNumber?: string;
  ksefNumber?: string;
};

export type InvoiceCorrection = {
  correctedInvoiceNumber?: string;
  reason?: string;
  type?: string;
  period?: string;
  isCollectiveDiscount?: boolean;
  references?: CorrectedInvoiceReference[];
};

export type InvoiceAnnotations = {
  splitPayment?: boolean;
  cashAccounting?: boolean;
  reverseCharge?: boolean;
  selfBilling?: boolean;
  simplifiedTriangularProcedure?: boolean;
  relatedParty?: boolean;
  fiscalReceipt?: boolean;
  exciseTaxRefund?: boolean;
  exemption?: {
    enabled?: boolean;
    legalBasis?: string;
    directiveBasis?: string;
    otherBasis?: string;
  };
  marginProcedure?: string;
  newTransportMeans?: {
    vatDocumentRequired?: string;
    lines?: {
      rowNumber?: string;
      firstUseDate?: string;
      description?: string;
      identifier?: string;
    }[];
  };
};

export type TransactionTerms = {
  contracts?: {
    date?: string;
    number?: string;
  }[];
  orders?: {
    date?: string;
    number?: string;
  }[];
  contractualCurrency?: string;
  contractualRate?: string;
  batchNumbers?: string[];
  deliveryTerms?: string;
  intermediaryDelivery?: boolean;
  transports?: {
    type?: string;
    otherTypeDescription?: string;
    orderNumber?: string;
    cargoDescription?: string;
    otherCargoDescription?: string;
    packageUnit?: string;
    startDateTime?: string;
    endDateTime?: string;
    carrier?: string;
    vehicleNumber?: string;
    description?: string;
    shipFrom?: string;
    shipTo?: string;
    shipThrough?: string[];
  }[];
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

export type InvoiceAttachment = {
  fileName?: string;
  description?: string;
  hash?: string;
};

export type WarehouseDocument = {
  number?: string;
  date?: string;
};

export type Invoice = {
  invoiceNumber: string;
  invoiceType?: string;
  invoiceTypeLabel?: string;
  issueDate: string;
  saleDate?: string;
  currency: string;
  details?: InvoiceDetails;
  correction?: InvoiceCorrection;
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
    status?: "paid" | "unpaid" | "paidInPart" | "paidAllInParts";
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
  annotations?: InvoiceAnnotations;
  additionalDescriptions?: AdditionalDescription[];
  thirdParties?: InvoiceParty[];
  authorizedParty?: InvoiceParty;
  settlements?: {
    charges?: SettlementLine[];
    deductions?: SettlementLine[];
    totalCharges?: number;
    totalDeductions?: number;
    amountToPay?: number;
    amountToSettle?: number;
  };
  orders?: OrderInfo[];
  transactionTerms?: TransactionTerms;
  warehouseDocuments?: WarehouseDocument[];
  attachments?: InvoiceAttachment[];
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
