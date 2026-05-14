import { z } from "zod";

const partySchema = z.object({
  name: z.string().min(1),
  vatId: z.string().optional(),
  address: z.string().optional(),
  role: z.string().optional(),
  customerNumber: z.string().optional()
});

const bankAccountSchema = z.object({
  accountNumber: z.string().min(1),
  swift: z.string().optional(),
  bankName: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(["seller", "factor"]).optional()
});

const orderLineSchema = z.object({
  lineNumber: z.string().optional(),
  uniqueRowNumber: z.string().optional(),
  index: z.string().optional(),
  name: z.string().optional(),
  translatedName: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  translatedUnit: z.string().optional(),
  unitPrice: z.number().optional(),
  netValue: z.number().optional(),
  vatValue: z.number().optional(),
  vatRate: z.string().optional(),
  ossVatRate: z.string().optional(),
  productMarker: z.string().optional(),
  gtin: z.string().optional(),
  pkwiu: z.string().optional(),
  cn: z.string().optional(),
  pkob: z.string().optional(),
  exciseTaxAmount: z.number().optional(),
  gtu: z.string().optional(),
  procedure: z.string().optional(),
  stateBefore: z.string().optional()
});

const detailsSchema = z.object({
  issuePlace: z.string().optional(),
  discountPeriod: z.string().optional(),
  serviceDate: z.string().optional(),
  serviceDateKind: z.enum(["paymentReceived", "deliveryOrService"]).optional(),
  serviceDateFrom: z.string().optional(),
  serviceDateTo: z.string().optional(),
  currencyCode: z.string().optional(),
  commonCurrencyRate: z.string().optional(),
  commonCurrencyRateApplies: z.boolean().optional(),
  hasOssProcedure: z.boolean().optional(),
  partialAdvances: z
    .array(
      z.object({
        date: z.string().optional(),
        amount: z.number().optional(),
        currencyRate: z.string().optional()
      })
    )
    .optional(),
  advanceInvoices: z
    .array(
      z.object({
        number: z.string().optional(),
        ksefNumber: z.string().optional()
      })
    )
    .optional()
}).optional();

const correctionSchema = z.object({
  correctedInvoiceNumber: z.string().optional(),
  reason: z.string().optional(),
  type: z.string().optional(),
  period: z.string().optional(),
  isCollectiveDiscount: z.boolean().optional(),
  references: z
    .array(
      z.object({
        issueDate: z.string().optional(),
        invoiceNumber: z.string().optional(),
        ksefNumber: z.string().optional()
      })
    )
    .optional()
}).optional();

const annotationsSchema = z.object({
  splitPayment: z.boolean().optional(),
  cashAccounting: z.boolean().optional(),
  reverseCharge: z.boolean().optional(),
  selfBilling: z.boolean().optional(),
  simplifiedTriangularProcedure: z.boolean().optional(),
  relatedParty: z.boolean().optional(),
  fiscalReceipt: z.boolean().optional(),
  exciseTaxRefund: z.boolean().optional(),
  exemption: z
    .object({
      enabled: z.boolean().optional(),
      legalBasis: z.string().optional(),
      directiveBasis: z.string().optional(),
      otherBasis: z.string().optional()
    })
    .optional(),
  marginProcedure: z.string().optional(),
  newTransportMeans: z
    .object({
      vatDocumentRequired: z.string().optional(),
      lines: z
        .array(
          z.object({
            rowNumber: z.string().optional(),
            firstUseDate: z.string().optional(),
            description: z.string().optional(),
            identifier: z.string().optional()
          })
        )
        .optional()
    })
    .optional()
}).optional();

const transactionTermsSchema = z.object({
  contracts: z.array(z.object({ date: z.string().optional(), number: z.string().optional() })).optional(),
  orders: z.array(z.object({ date: z.string().optional(), number: z.string().optional() })).optional(),
  contractualCurrency: z.string().optional(),
  contractualRate: z.string().optional(),
  batchNumbers: z.array(z.string()).optional(),
  deliveryTerms: z.string().optional(),
  intermediaryDelivery: z.boolean().optional(),
  transports: z
    .array(
      z.object({
        type: z.string().optional(),
        otherTypeDescription: z.string().optional(),
        orderNumber: z.string().optional(),
        cargoDescription: z.string().optional(),
        otherCargoDescription: z.string().optional(),
        packageUnit: z.string().optional(),
        startDateTime: z.string().optional(),
        endDateTime: z.string().optional(),
        carrier: z.string().optional(),
        vehicleNumber: z.string().optional(),
        description: z.string().optional(),
        shipFrom: z.string().optional(),
        shipTo: z.string().optional(),
        shipThrough: z.array(z.string()).optional()
      })
    )
    .optional()
}).optional();

export const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  invoiceType: z.string().optional(),
  invoiceTypeLabel: z.string().optional(),
  issueDate: z.string().min(1),
  saleDate: z.string().optional(),
  currency: z.string().min(3).max(3).default("PLN"),
  details: detailsSchema,
  correction: correctionSchema,
  seller: partySchema,
  buyer: partySchema,
  items: z.array(
    z.object({
      index: z.string().optional(),
      lineNumber: z.string().optional(),
      uniqueRowNumber: z.string().optional(),
      name: z.string().min(1),
      translatedName: z.string().optional(),
      quantity: z.number(),
      unit: z.string().optional(),
      translatedUnit: z.string().optional(),
      unitPrice: z.number(),
      grossUnitPrice: z.number().optional(),
      discount: z.number().optional(),
      netValue: z.number(),
      vatRate: z.string(),
      grossValue: z.number(),
      vatValue: z.number().optional(),
      ossVatRate: z.string().optional(),
      productMarker: z.string().optional(),
      currencyRate: z.string().optional(),
      stateBefore: z.string().optional(),
      gtin: z.string().optional(),
      pkwiu: z.string().optional(),
      cn: z.string().optional(),
      pkob: z.string().optional(),
      exciseTaxAmount: z.number().optional(),
      gtu: z.string().optional(),
      procedure: z.string().optional(),
      receiptDate: z.string().optional()
    })
  ),
  totals: z.object({
    net: z.number(),
    vat: z.number(),
    gross: z.number()
  }),
  payment: z
    .object({
      dueDate: z.string().optional(),
      method: z.string().optional(),
      methodLabel: z.string().optional(),
      isPaid: z.string().optional(),
      status: z.enum(["paid", "unpaid", "paidInPart", "paidAllInParts"]).optional(),
      paidDate: z.string().optional(),
      otherMethodDescription: z.string().optional(),
      bankAccount: z.string().optional(),
      bankAccounts: z.array(bankAccountSchema).optional(),
      factorBankAccounts: z.array(bankAccountSchema).optional(),
      paymentTerms: z
        .array(
          z.object({
            dueDate: z.string().optional(),
            description: z.string().optional()
          })
        )
        .optional(),
      partialPayments: z
        .array(
          z.object({
            amount: z.number().optional(),
            date: z.string().optional(),
            method: z.string().optional(),
            otherMethodDescription: z.string().optional()
          })
        )
        .optional(),
      discounts: z
        .array(
          z.object({
            conditions: z.string().optional(),
            amount: z.number().optional()
          })
        )
        .optional(),
      paymentLink: z.string().optional(),
      ipKsef: z.string().optional()
    })
    .optional(),
  taxBreakdown: z
    .array(
      z.object({
        code: z.string(),
        label: z.string(),
        net: z.number().optional(),
        vat: z.number().optional(),
        gross: z.number().optional(),
        vatInPln: z.number().optional()
      })
    )
    .optional(),
  annotations: annotationsSchema,
  additionalDescriptions: z
    .array(
      z.object({
        lineNumber: z.string().optional(),
        key: z.string().optional(),
        value: z.string(),
        translatedKey: z.string().optional(),
        translatedValue: z.string().optional()
      })
    )
    .optional(),
  thirdParties: z.array(partySchema).optional(),
  authorizedParty: partySchema.optional(),
  settlements: z
    .object({
      charges: z
        .array(
          z.object({
            type: z.literal("charge"),
            amount: z.number().optional(),
            reason: z.string().optional(),
            translatedReason: z.string().optional()
          })
        )
        .optional(),
      deductions: z
        .array(
          z.object({
            type: z.literal("deduction"),
            amount: z.number().optional(),
            reason: z.string().optional(),
            translatedReason: z.string().optional()
          })
        )
        .optional(),
      totalCharges: z.number().optional(),
      totalDeductions: z.number().optional(),
      amountToPay: z.number().optional(),
      amountToSettle: z.number().optional()
    })
    .optional(),
  orders: z
    .array(
      z.object({
        orderNumber: z.string().optional(),
        contractNumber: z.string().optional(),
        orderDate: z.string().optional(),
        contractDate: z.string().optional(),
        totalValue: z.number().optional(),
        lines: z.array(orderLineSchema).optional()
      })
    )
    .optional(),
  transactionTerms: transactionTermsSchema,
  warehouseDocuments: z
    .array(
      z.object({
        number: z.string().optional(),
        date: z.string().optional()
      })
    )
    .optional(),
  attachments: z
    .array(
      z.object({
        fileName: z.string().optional(),
        description: z.string().optional(),
        hash: z.string().optional()
      })
    )
    .optional(),
  verification: z
    .object({
      ksefNumber: z.string().optional(),
      qrLink: z.string().optional()
    })
    .optional(),
  notes: z.string().optional(),
  translatedNotes: z.string().optional(),
  footer: z
    .object({
      text: z.string().optional(),
      translatedText: z.string().optional(),
      registry: z
        .object({
          fullName: z.string().optional(),
          krs: z.string().optional(),
          regon: z.string().optional(),
          bdo: z.string().optional()
        })
        .optional()
    })
    .optional(),
  sourceXml: z.string().optional()
});
