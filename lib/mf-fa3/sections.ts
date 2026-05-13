import type { Invoice } from "@/types/invoice";

export const MF_FA3_SECTION_ORDER = [
  "header",
  "correctedInvoiceData",
  "parties",
  "details",
  "rowsOrDiscount",
  "orders",
  "taxSummary",
  "annotations",
  "additionalInformation",
  "settlements",
  "payment",
  "transactionTerms",
  "footer",
  "attachments",
  "verification"
] as const;

export type MfFa3SectionId = (typeof MF_FA3_SECTION_ORDER)[number];

export function isCollectiveDiscountCorrection(invoice: Invoice) {
  return Boolean(invoice.correction?.isCollectiveDiscount);
}

export function hasCorrectionData(invoice: Invoice) {
  const correction = invoice.correction;
  return Boolean(
    correction?.correctedInvoiceNumber ||
      correction?.reason ||
      correction?.type ||
      correction?.period ||
      correction?.references?.length
  );
}

export function hasDetails(invoice: Invoice) {
  const details = invoice.details;
  return Boolean(
    details?.issuePlace ||
      details?.discountPeriod ||
      details?.serviceDate ||
      details?.serviceDateFrom ||
      details?.serviceDateTo ||
      details?.currencyCode ||
      details?.commonCurrencyRate ||
      details?.commonCurrencyRateApplies ||
      details?.hasOssProcedure ||
      details?.partialAdvances?.length ||
      details?.advanceInvoices?.length
  );
}

export function hasTaxSummary(invoice: Invoice) {
  return Boolean(invoice.taxBreakdown?.length);
}

export function hasAnnotations(invoice: Invoice) {
  const annotations = invoice.annotations;
  return Boolean(
    annotations?.splitPayment ||
      annotations?.cashAccounting ||
      annotations?.reverseCharge ||
      annotations?.selfBilling ||
      annotations?.simplifiedTriangularProcedure ||
      annotations?.relatedParty ||
      annotations?.fiscalReceipt ||
      annotations?.exciseTaxRefund ||
      annotations?.exemption?.enabled ||
      annotations?.marginProcedure ||
      annotations?.newTransportMeans?.vatDocumentRequired ||
      annotations?.newTransportMeans?.lines?.length
  );
}

export function hasAdditionalInformation(invoice: Invoice) {
  return Boolean(invoice.additionalDescriptions?.length);
}

export function hasSettlements(invoice: Invoice) {
  const settlements = invoice.settlements;
  return Boolean(
    settlements?.charges?.length ||
      settlements?.deductions?.length ||
      settlements?.totalCharges !== undefined ||
      settlements?.totalDeductions !== undefined ||
      settlements?.amountToPay !== undefined ||
      settlements?.amountToSettle !== undefined
  );
}

export function hasPayment(invoice: Invoice) {
  const payment = invoice.payment;
  return Boolean(
    payment?.dueDate ||
      payment?.method ||
      payment?.methodLabel ||
      payment?.isPaid ||
      payment?.paidDate ||
      payment?.bankAccount ||
      payment?.bankAccounts?.length ||
      payment?.factorBankAccounts?.length ||
      payment?.paymentTerms?.length ||
      payment?.partialPayments?.length ||
      payment?.discounts?.length ||
      payment?.paymentLink ||
      payment?.ipKsef
  );
}

export function hasOrders(invoice: Invoice) {
  return Boolean(invoice.orders?.length);
}

export function hasTransactionTerms(invoice: Invoice) {
  const terms = invoice.transactionTerms;
  return Boolean(
    terms?.contracts?.length ||
      terms?.orders?.length ||
      terms?.contractualCurrency ||
      terms?.contractualRate ||
      terms?.batchNumbers?.length ||
      terms?.deliveryTerms ||
      terms?.intermediaryDelivery !== undefined ||
      terms?.transports?.length
  );
}

export function hasFooter(invoice: Invoice) {
  return Boolean(invoice.footer?.text || invoice.footer?.registry);
}

export function hasAttachments(invoice: Invoice) {
  return Boolean(invoice.warehouseDocuments?.length || invoice.attachments?.length);
}

export function hasVerification(invoice: Invoice) {
  return Boolean(invoice.verification?.ksefNumber || invoice.verification?.qrLink);
}
