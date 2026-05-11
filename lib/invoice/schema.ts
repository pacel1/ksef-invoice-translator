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
  index: z.string().optional(),
  name: z.string().optional(),
  translatedName: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  translatedUnit: z.string().optional(),
  unitPrice: z.number().optional(),
  netValue: z.number().optional(),
  vatValue: z.number().optional(),
  vatRate: z.string().optional()
});

export const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  invoiceType: z.string().optional(),
  invoiceTypeLabel: z.string().optional(),
  issueDate: z.string().min(1),
  saleDate: z.string().optional(),
  currency: z.string().min(3).max(3).default("PLN"),
  seller: partySchema,
  buyer: partySchema,
  items: z.array(
    z.object({
      index: z.string().optional(),
      name: z.string().min(1),
      translatedName: z.string().optional(),
      quantity: z.number(),
      unit: z.string().optional(),
      translatedUnit: z.string().optional(),
      unitPrice: z.number(),
      netValue: z.number(),
      vatRate: z.string(),
      grossValue: z.number()
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
        vatInPln: z.number().optional()
      })
    )
    .optional(),
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
      amountToSettle: z.number().optional()
    })
    .optional(),
  orders: z
    .array(
      z.object({
        orderNumber: z.string().optional(),
        contractNumber: z.string().optional(),
        totalValue: z.number().optional(),
        lines: z.array(orderLineSchema).optional()
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
    .optional()
});
