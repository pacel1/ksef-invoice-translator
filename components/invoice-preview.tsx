"use client";

import { useEffect, useState } from "react";
import type React from "react";
import QRCode from "qrcode";
import type { Invoice, InvoiceDetails, LanguageCode } from "@/types/invoice";
import { getBilingualLabels, getLabels, getPolishLabels } from "@/lib/translation/dictionaries";
import { formatMoney } from "@/lib/invoice/format";
import { MF_FA3_SECTION_ORDER, type MfFa3SectionId } from "@/lib/mf-fa3/sections";

export function InvoicePreview({
  invoice,
  language,
  bilingual,
  translated = true
}: {
  invoice: Invoice;
  language: LanguageCode;
  bilingual: boolean;
  translated?: boolean;
}) {
  const previewInvoice = translated ? invoice : originalInvoice(invoice);
  const effectiveBilingual = translated && bilingual;
  const labels = translated ? (effectiveBilingual ? getBilingualLabels(language) : getLabels(language)) : getPolishLabels();

  return (
    <div className="overflow-x-auto pb-4">
      <section className="mx-auto min-h-[1123px] w-[794px] max-w-none border border-slate-300 bg-white px-10 py-8 text-[11px] leading-tight text-slate-950 shadow-soft print:w-full print:border-0 print:shadow-none">
      <div className="flex flex-col gap-5 border-b border-slate-400 pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-medium text-slate-600">KSeF Invoice Translator</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-normal text-slate-950">{labels.invoice}</h2>
        </div>
        <dl className="grid min-w-72 grid-cols-[1fr_auto] gap-x-5 gap-y-1 text-[11px]">
          <dt className="text-slate-500">{labels.invoiceNumber}</dt>
          <dd className="font-medium">{previewInvoice.invoiceNumber}</dd>
          {previewInvoice.invoiceType || previewInvoice.invoiceTypeLabel ? (
            <>
              <dt className="text-slate-500">{labels.invoiceType}</dt>
              <dd className="font-medium">{invoiceTypeLabel(previewInvoice, labels, effectiveBilingual)}</dd>
            </>
          ) : null}
          <dt className="text-slate-500">{labels.issueDate}</dt>
          <dd>{previewInvoice.issueDate}</dd>
          <dt className="text-slate-500">{labels.saleDate}</dt>
          <dd>{previewInvoice.saleDate ?? "-"}</dd>
          <dt className="text-slate-500">{labels.currency}</dt>
          <dd>{previewInvoice.currency}</dd>
        </dl>
      </div>

      {MF_FA3_SECTION_ORDER.filter((sectionId) => sectionId !== "header").map((sectionId) =>
        renderPreviewSection(sectionId, previewInvoice, labels, effectiveBilingual)
      )}
      </section>
    </div>
  );
}

function originalInvoice(invoice: Invoice): Invoice {
  return {
    ...invoice,
    items: invoice.items.map(({ translatedName: _translatedName, translatedUnit: _translatedUnit, ...item }) => item),
    additionalDescriptions: invoice.additionalDescriptions?.map(
      ({ translatedKey: _translatedKey, translatedValue: _translatedValue, ...entry }) => entry
    ),
    settlements: invoice.settlements
      ? {
          ...invoice.settlements,
          charges: invoice.settlements.charges?.map(({ translatedReason: _translatedReason, ...line }) => line),
          deductions: invoice.settlements.deductions?.map(({ translatedReason: _translatedReason, ...line }) => line)
        }
      : undefined,
    orders: invoice.orders?.map((order) => ({
      ...order,
      lines: order.lines?.map(({ translatedName: _translatedName, translatedUnit: _translatedUnit, ...line }) => line)
    })),
    translatedNotes: undefined,
    footer: invoice.footer
      ? {
          ...invoice.footer,
          translatedText: undefined
        }
      : undefined
  };
}

function PartyCard({
  title,
  party,
  vatLabel
}: {
  title: string;
  party: Invoice["seller"];
  vatLabel: string;
}) {
  return (
    <div className="border border-border p-4">
      <h3 className="mb-3 font-semibold text-cyan-800">{title}</h3>
      <p className="font-medium text-slate-950">{party.name}</p>
      <p className="mt-2 text-sm text-slate-600">{vatLabel}: {party.vatId ?? "-"}</p>
      <p className="text-sm text-slate-600">{party.address ?? "-"}</p>
    </div>
  );
}

function renderPreviewSection(
  sectionId: MfFa3SectionId,
  invoice: Invoice,
  labels: Record<string, string>,
  bilingual: boolean
) {
  switch (sectionId) {
    case "header":
      return null;
    case "correctedInvoiceData":
      return <CorrectionSection key={sectionId} invoice={invoice} labels={labels} />;
    case "parties":
      return <PartiesSection key={sectionId} invoice={invoice} labels={labels} />;
    case "details":
      return <DetailsSection key={sectionId} invoice={invoice} labels={labels} />;
    case "rowsOrDiscount":
      return <ItemsSection key={sectionId} invoice={invoice} labels={labels} bilingual={bilingual} />;
    case "orders":
      return invoice.orders?.length ? (
        <DataSection key={sectionId} title={labels.orders}>
          <OrdersTable invoice={invoice} labels={labels} bilingual={bilingual} />
        </DataSection>
      ) : null;
    case "taxSummary":
      return <TaxSummarySection key={sectionId} invoice={invoice} labels={labels} />;
    case "annotations":
      return <AnnotationsSection key={sectionId} invoice={invoice} labels={labels} />;
    case "additionalInformation":
      return <AdditionalDescriptionsSection key={sectionId} invoice={invoice} labels={labels} bilingual={bilingual} />;
    case "settlements":
      return <SettlementsSection key={sectionId} invoice={invoice} labels={labels} bilingual={bilingual} />;
    case "payment":
      return <PaymentSection key={sectionId} invoice={invoice} labels={labels} />;
    case "transactionTerms":
      return <TransactionTermsSection key={sectionId} invoice={invoice} labels={labels} />;
    case "footer":
      return <FooterSection key={sectionId} invoice={invoice} labels={labels} bilingual={bilingual} />;
    case "attachments":
      return <AttachmentsSection key={sectionId} invoice={invoice} labels={labels} />;
    case "verification":
      return <VerificationSection key={sectionId} invoice={invoice} labels={labels} />;
  }
}

function PartiesSection({ invoice, labels }: { invoice: Invoice; labels: Record<string, string> }) {
  return (
    <>
      <div className="grid gap-4 py-6 md:grid-cols-2">
        <PartyCard title={labels.seller} party={invoice.seller} vatLabel={labels.vatId} />
        <PartyCard title={labels.buyer} party={invoice.buyer} vatLabel={labels.vatId} />
      </div>
      {invoice.thirdParties?.length ? (
        <DataSection title={labels.thirdParties}>
          <div className="grid gap-4 md:grid-cols-2">
            {invoice.thirdParties.map((party, index) => (
              <PartyCard key={`${party.name}-${index}`} title={party.role ?? `${labels.thirdParties} ${index + 1}`} party={party} vatLabel={labels.vatId} />
            ))}
          </div>
        </DataSection>
      ) : null}
      {invoice.authorizedParty ? (
        <DataSection title={labels.authorizedParty}>
          <PartyCard title={labels.authorizedParty} party={invoice.authorizedParty} vatLabel={labels.vatId} />
        </DataSection>
      ) : null}
    </>
  );
}

function CorrectionSection({ invoice, labels }: { invoice: Invoice; labels: Record<string, string> }) {
  const correction = invoice.correction;
  if (!correction) return null;
  const rows = [
    { label: label(labels, "correctedInvoiceNumber", "Numer faktury korygowanej"), value: correction.correctedInvoiceNumber ?? "-" },
    { label: labels.reason, value: correction.reason ?? "-" },
    { label: label(labels, "correctionType", "Typ korekty"), value: correction.type ?? "-" },
    { label: label(labels, "correctionPeriod", "Okres korekty"), value: correction.period ?? "-" },
    ...(correction.references ?? []).flatMap((reference, index) => [
      { label: `${labels.invoiceNumber} ${index + 1}`, value: reference.invoiceNumber ?? "-" },
      { label: `${labels.issueDate} ${index + 1}`, value: reference.issueDate ?? "-" },
      { label: `${labels.ksefNumber} ${index + 1}`, value: reference.ksefNumber ?? "-" }
    ])
  ].filter((row) => row.value !== "-");
  if (!rows.length) return null;
  return (
    <DataSection title={label(labels, "correctedInvoiceData", "Dane faktury korygowanej")}>
      <KeyValueGrid rows={rows} />
    </DataSection>
  );
}

function DetailsSection({ invoice, labels }: { invoice: Invoice; labels: Record<string, string> }) {
  const details = invoice.details;
  if (!details) return null;

  const rows = [
    { label: label(labels, "issueDateWithKsefClause", "Data wystawienia z zastrzezeniem art. 106na ust. 1 ustawy"), value: invoice.issueDate },
    { label: label(labels, "issuePlace", "Miejsce wystawienia"), value: details.issuePlace ?? "-" },
    { label: label(labels, "discountPeriod", "Okres, ktorego dotyczy rabat"), value: details.discountPeriod ?? "-" },
    { label: serviceDateLabel(details.serviceDateKind, labels), value: details.serviceDate ?? invoice.saleDate ?? "-" },
    { label: label(labels, "servicePeriod", "Okres dostawy/uslugi"), value: servicePeriodValue(details) ?? "-" },
    { label: label(labels, "currencyCode", "Kod waluty"), value: details.currencyCode ?? invoice.currency },
    { label: label(labels, "ossProcedure", "Procedura OSS"), value: details.hasOssProcedure ? label(labels, "yes", "Tak") : "-" },
    { label: label(labels, "commonCurrencyRateApplies", "Kurs waluty wspolny dla wszystkich wierszy faktury"), value: details.commonCurrencyRateApplies ? label(labels, "yes", "Tak") : "-" },
    { label: label(labels, "currencyRate", "Kurs waluty"), value: details.commonCurrencyRate ?? "-" }
  ].filter((row) => row.value !== "-");

  const partialAdvanceRows =
    details.partialAdvances?.flatMap((advance, index) => [
      { label: `${label(labels, "partialAdvances", "Zaliczka czesciowa")} ${index + 1}`, value: moneyOrDash(advance.amount, invoice.currency) },
      { label: `${labels.paidDate} ${index + 1}`, value: advance.date ?? "-" },
      { label: `${label(labels, "currencyRate", "Kurs waluty")} ${index + 1}`, value: advance.currencyRate ?? "-" }
    ]).filter((row) => row.value !== "-") ?? [];

  const advanceInvoiceRows =
    details.advanceInvoices?.flatMap((advance, index) => [
      { label: `${label(labels, "advanceInvoices", "Faktura zaliczkowa")} ${index + 1}`, value: advance.number ?? "-" },
      { label: `${labels.ksefNumber} ${index + 1}`, value: advance.ksefNumber ?? "-" }
    ]).filter((row) => row.value !== "-") ?? [];

  const allRows = [...rows, ...partialAdvanceRows, ...advanceInvoiceRows];
  if (!allRows.length) return null;

  return (
    <DataSection title={label(labels, "details", "Szczegoly")}>
      <KeyValueGrid rows={allRows} />
    </DataSection>
  );
}

function ItemsSection({
  invoice,
  labels,
  bilingual
}: {
  invoice: Invoice;
  labels: Record<string, string>;
  bilingual: boolean;
}) {
  const showIndex = invoice.items.some((item) => item.index);
  const distinctRates = new Set(invoice.items.map((item) => item.currencyRate).filter(Boolean));
  const showCurrencyRate = distinctRates.size !== 1 && invoice.items.some((item) => item.currencyRate);

  if (invoice.correction?.isCollectiveDiscount) {
    const appliesText = invoice.items.some((item) => item.lineNumber)
      ? label(labels, "discountAppliesSelectedRows", "Rabat nie dotyczy wszystkich dostaw towarow i wykonanych uslug na rzecz tego nabywcy w danym okresie.")
      : label(labels, "discountAppliesAllRows", "Rabat dotyczy wszystkich dostaw towarow i wykonanych uslug na rzecz tego nabywcy w danym okresie.");
    return (
      <DataSection title={label(labels, "discountCorrection", "Rabat")}>
        <KeyValueGrid
          rows={[
            { label: label(labels, "discountPeriod", "Okres, ktorego dotyczy rabat"), value: invoice.correction.period ?? "-" },
            { label: labels.reason, value: invoice.correction.reason ?? "-" },
            { label: labels.grossTotal, value: formatMoney(invoice.totals.gross, invoice.currency) }
          ].filter((row) => row.value !== "-")}
        />
        <p className="mt-3 text-sm text-slate-700">{appliesText}</p>
      </DataSection>
    );
  }

  return (
    <DataSection title={label(labels, "rows", "Pozycje")}>
      <div className="overflow-x-auto border border-border">
        <table className={showIndex ? "min-w-[1080px] w-full border-collapse text-sm" : "min-w-[980px] w-full border-collapse text-sm"}>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {showIndex ? <th className="border-b border-border p-3">{labels.index}</th> : null}
              <th className="border-b border-border p-3">{labels.description}</th>
              <th className="border-b border-border p-3 text-right">{labels.quantity}</th>
              <th className="border-b border-border p-3 text-right">{labels.unitPrice}</th>
              <th className="border-b border-border p-3 text-right">{labels.vatRate}</th>
              {showCurrencyRate ? <th className="border-b border-border p-3 text-right">{label(labels, "currencyRate", "Kurs waluty")}</th> : null}
              <th className="border-b border-border p-3 text-right">{labels.netValue}</th>
              <th className="border-b border-border p-3 text-right">{labels.grossValue}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={`${item.name}-${index}`} className="border-b border-border last:border-0">
                {showIndex ? <td className="p-3 align-top text-xs font-medium text-slate-700">{item.index ?? "-"}</td> : null}
                <td className="p-3">
                  <div className="font-medium">{displayText(item.translatedName, item.name, bilingual)}</div>
                </td>
                <td className="p-3 text-right">
                  {item.quantity} {unitLabel(item.unit, item.translatedUnit, bilingual)}
                </td>
                <td className="p-3 text-right">{formatMoney(item.unitPrice, invoice.currency)}</td>
                <td className="p-3 text-right">{item.vatRate}</td>
                {showCurrencyRate ? <td className="p-3 text-right">{item.currencyRate ?? "-"}</td> : null}
                <td className="p-3 text-right">{formatMoney(item.netValue, invoice.currency)}</td>
                <td className="p-3 text-right">{formatMoney(item.grossValue, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto mt-4 max-w-sm space-y-3 border-t-2 border-cyan-700 pt-4 text-sm">
        <TotalRow label={labels.netTotal} value={formatMoney(invoice.totals.net, invoice.currency)} />
        <TotalRow label={labels.vatTotal} value={formatMoney(invoice.totals.vat, invoice.currency)} />
        <TotalRow label={labels.grossTotal} value={formatMoney(invoice.totals.gross, invoice.currency)} strong />
      </dl>
    </DataSection>
  );
}

function TaxSummarySection({ invoice, labels }: { invoice: Invoice; labels: Record<string, string> }) {
  if (!invoice.taxBreakdown?.length) return null;
  const showVatInPln = invoice.taxBreakdown.some((line) => line.vatInPln !== undefined);
  return (
    <DataSection title={labels.taxSummary}>
      <div className="overflow-x-auto border border-border">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-border p-3">Lp.</th>
              <th className="border-b border-border p-3">{label(labels, "taxRate", "Stawka podatku")}</th>
              <th className="border-b border-border p-3 text-right">{labels.netValue}</th>
              <th className="border-b border-border p-3 text-right">{labels.vatTotal}</th>
              <th className="border-b border-border p-3 text-right">{labels.grossValue}</th>
              {showVatInPln ? <th className="border-b border-border p-3 text-right">VAT PLN</th> : null}
            </tr>
          </thead>
          <tbody>
            {invoice.taxBreakdown.map((line) => (
              <tr key={line.code} className="border-b border-border last:border-0">
                <td className="p-3">{line.code}</td>
                <td className="p-3">{line.label}</td>
                <td className="p-3 text-right">{moneyOrDash(line.net, invoice.currency)}</td>
                <td className="p-3 text-right">{moneyOrDash(line.vat, invoice.currency)}</td>
                <td className="p-3 text-right">{moneyOrDash(line.gross, invoice.currency)}</td>
                {showVatInPln ? <td className="p-3 text-right">{moneyOrDash(line.vatInPln, "PLN")}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataSection>
  );
}

function AdditionalDescriptionsSection({
  invoice,
  labels,
  bilingual
}: {
  invoice: Invoice;
  labels: Record<string, string>;
  bilingual: boolean;
}) {
  if (!invoice.additionalDescriptions?.length) return null;
  return (
    <DataSection title={labels.additionalInformation}>
      <div className="overflow-x-auto border border-border">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-border p-3">{labels.line}</th>
              <th className="border-b border-border p-3">{labels.key}</th>
              <th className="border-b border-border p-3">{labels.value}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.additionalDescriptions.map((entry, index) => (
              <tr key={`${entry.lineNumber}-${entry.key}-${index}`} className="border-b border-border last:border-0">
                <td className="p-3">{entry.lineNumber ?? "-"}</td>
                <td className="p-3">{displayText(entry.translatedKey, entry.key, bilingual)}</td>
                <td className="p-3">{displayText(entry.translatedValue, entry.value, bilingual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataSection>
  );
}

function AnnotationsSection({ invoice, labels }: { invoice: Invoice; labels: Record<string, string> }) {
  const annotations = invoice.annotations;
  if (!annotations) return null;
  const rows = [
    { label: label(labels, "splitPayment", "Mechanizm podzielonej platnosci"), value: annotations.splitPayment ? label(labels, "yes", "Tak") : "-" },
    { label: label(labels, "cashAccounting", "Metoda kasowa"), value: annotations.cashAccounting ? label(labels, "yes", "Tak") : "-" },
    { label: label(labels, "reverseCharge", "Odwrotne obciazenie"), value: annotations.reverseCharge ? label(labels, "yes", "Tak") : "-" },
    { label: label(labels, "selfBilling", "Samofakturowanie"), value: annotations.selfBilling ? label(labels, "yes", "Tak") : "-" },
    { label: label(labels, "simplifiedTriangularProcedure", "Procedura trojstronna uproszczona"), value: annotations.simplifiedTriangularProcedure ? label(labels, "yes", "Tak") : "-" },
    { label: label(labels, "relatedParty", "Podmiot powiazany"), value: annotations.relatedParty ? label(labels, "yes", "Tak") : "-" },
    { label: label(labels, "fiscalReceipt", "Paragon fiskalny"), value: annotations.fiscalReceipt ? label(labels, "yes", "Tak") : "-" },
    { label: label(labels, "exciseTaxRefund", "Zwrot akcyzy"), value: annotations.exciseTaxRefund ? label(labels, "yes", "Tak") : "-" },
    { label: label(labels, "taxExemption", "Zwolnienie z podatku"), value: annotations.exemption?.enabled ? label(labels, "yes", "Tak") : "-" },
    { label: label(labels, "legalBasis", "Podstawa prawna"), value: annotations.exemption?.legalBasis ?? "-" },
    { label: label(labels, "directiveBasis", "Podstawa dyrektywy"), value: annotations.exemption?.directiveBasis ?? "-" },
    { label: label(labels, "otherBasis", "Inna podstawa"), value: annotations.exemption?.otherBasis ?? "-" },
    { label: label(labels, "marginProcedure", "Procedura marzy"), value: annotations.marginProcedure ?? "-" },
    { label: label(labels, "newTransportMeans", "Nowy srodek transportu"), value: annotations.newTransportMeans?.vatDocumentRequired ?? "-" }
  ].filter((row) => row.value !== "-");
  if (!rows.length) return null;
  return (
    <DataSection title={label(labels, "annotations", "Adnotacje")}>
      <KeyValueGrid rows={rows} />
    </DataSection>
  );
}

function SettlementsSection({
  invoice,
  labels,
  bilingual
}: {
  invoice: Invoice;
  labels: Record<string, string>;
  bilingual: boolean;
}) {
  if (!invoice.settlements) return null;
  const rows = [
    ...(invoice.settlements.charges ?? []).map((line, index) => ({
      label: `${labels.charges} ${index + 1}`,
      value: `${moneyOrDash(line.amount, invoice.currency)} ${displayPlainText(line.translatedReason, line.reason, bilingual)}`.trim()
    })),
    ...(invoice.settlements.deductions ?? []).map((line, index) => ({
      label: `${labels.deductions} ${index + 1}`,
      value: `${moneyOrDash(line.amount, invoice.currency)} ${displayPlainText(line.translatedReason, line.reason, bilingual)}`.trim()
    })),
    { label: label(labels, "totalCharges", "Suma obciążeń"), value: moneyOrDash(invoice.settlements.totalCharges, invoice.currency) },
    { label: label(labels, "totalDeductions", "Suma odliczeń"), value: moneyOrDash(invoice.settlements.totalDeductions, invoice.currency) },
    { label: label(labels, "amountToPay", "Do zapłaty"), value: moneyOrDash(invoice.settlements.amountToPay, invoice.currency) },
    { label: labels.amountToSettle, value: moneyOrDash(invoice.settlements.amountToSettle, invoice.currency) }
  ].filter((row) => row.value && row.value !== "-");
  if (!rows.length) return null;
  return (
    <DataSection title={labels.settlements}>
      <KeyValueGrid rows={rows} />
    </DataSection>
  );
}

function PaymentSection({ invoice, labels }: { invoice: Invoice; labels: Record<string, string> }) {
  const payment = invoice.payment;
  if (!payment) return null;
  const paymentRows = [
    { label: label(labels, "paymentInformation", "Informacja o platnosci"), value: paymentStatusLabel(payment.status, labels) },
    { label: labels.dueDate, value: payment.dueDate ?? "-" },
    { label: labels.method, value: payment.methodLabel ?? payment.method ?? "-" },
    { label: labels.paidDate, value: payment.paidDate ?? "-" },
    ...(payment.paymentTerms ?? []).map((term, index) => ({
      label: `${labels.paymentTerms} ${index + 1}`,
      value: [term.dueDate, term.description].filter(Boolean).join(" - ") || "-"
    })),
    ...(payment.partialPayments ?? []).flatMap((partialPayment, index) => [
      { label: `${labels.amount} ${index + 1}`, value: moneyOrDash(partialPayment.amount, invoice.currency) },
      { label: `${labels.paidDate} ${index + 1}`, value: partialPayment.date ?? "-" },
      { label: `${labels.method} ${index + 1}`, value: partialPayment.method ?? partialPayment.otherMethodDescription ?? "-" }
    ]),
    ...(payment.discounts ?? []).flatMap((discount, index) => [
      { label: `${label(labels, "discountConditions", "Warunki skonta")} ${index + 1}`, value: discount.conditions ?? "-" },
      { label: `${label(labels, "discountAmount", "Wysokosc skonta")} ${index + 1}`, value: moneyOrDash(discount.amount, invoice.currency) }
    ])
  ].filter((row) => row.value !== "-");

  if (!paymentRows.length && !payment.bankAccounts?.length && !payment.factorBankAccounts?.length) return null;

  return (
    <>
      {paymentRows.length ? (
        <DataSection title={labels.payment}>
          <KeyValueGrid rows={paymentRows} />
        </DataSection>
      ) : null}
      {payment.bankAccounts?.length ? <BankAccounts title={labels.bankAccounts} accounts={payment.bankAccounts} labels={labels} /> : null}
      {payment.factorBankAccounts?.length ? (
        <BankAccounts title={labels.factorBankAccounts} accounts={payment.factorBankAccounts} labels={labels} />
      ) : null}
    </>
  );
}

function TransactionTermsSection({ invoice, labels }: { invoice: Invoice; labels: Record<string, string> }) {
  const terms = invoice.transactionTerms;
  if (!terms) return null;
  const rows = [
    ...(terms.contracts ?? []).flatMap((contract, index) => [
      { label: `${label(labels, "contracts", "Umowa")} ${index + 1}`, value: contract.number ?? "-" },
      { label: `${labels.issueDate} ${index + 1}`, value: contract.date ?? "-" }
    ]),
    ...(terms.orders ?? []).flatMap((order, index) => [
      { label: `${labels.orders} ${index + 1}`, value: order.number ?? "-" },
      { label: `${labels.issueDate} ${index + 1}`, value: order.date ?? "-" }
    ]),
    { label: label(labels, "contractualCurrency", "Waluta umowna"), value: terms.contractualCurrency ?? "-" },
    { label: label(labels, "contractualRate", "Kurs umowny"), value: terms.contractualRate ?? "-" },
    { label: label(labels, "batchNumbers", "Partia towaru"), value: terms.batchNumbers?.join(", ") ?? "-" },
    { label: label(labels, "deliveryTerms", "Warunki dostawy"), value: terms.deliveryTerms ?? "-" },
    { label: label(labels, "intermediaryDelivery", "Dostawa przez podmiot posredniczacy"), value: terms.intermediaryDelivery === undefined ? "-" : terms.intermediaryDelivery ? label(labels, "yes", "Tak") : "Nie" },
    ...(terms.transports ?? []).flatMap((transport, index) => [
      { label: `${label(labels, "transportType", "Rodzaj transportu")} ${index + 1}`, value: transport.type ?? "-" },
      { label: `${label(labels, "otherTypeDescription", "Opis innego transportu")} ${index + 1}`, value: transport.otherTypeDescription ?? "-" },
      { label: `${labels.orderNumber} ${index + 1}`, value: transport.orderNumber ?? "-" },
      { label: `${label(labels, "cargoDescription", "Opis ladunku")} ${index + 1}`, value: transport.cargoDescription ?? "-" },
      { label: `${label(labels, "otherCargoDescription", "Opis innego ladunku")} ${index + 1}`, value: transport.otherCargoDescription ?? "-" },
      { label: `${label(labels, "packageUnit", "Jednostka opakowania")} ${index + 1}`, value: transport.packageUnit ?? "-" },
      { label: `${label(labels, "transportStart", "Rozpoczecie transportu")} ${index + 1}`, value: transport.startDateTime ?? "-" },
      { label: `${label(labels, "transportEnd", "Zakonczenie transportu")} ${index + 1}`, value: transport.endDateTime ?? "-" },
      { label: `${label(labels, "carrier", "Przewoznik")} ${index + 1}`, value: transport.carrier ?? "-" },
      { label: `${label(labels, "vehicleNumber", "Numer srodka transportu")} ${index + 1}`, value: transport.vehicleNumber ?? "-" },
      { label: `${labels.description} ${index + 1}`, value: transport.description ?? "-" },
      { label: `${label(labels, "shipFrom", "Wysylka z")} ${index + 1}`, value: transport.shipFrom ?? "-" },
      { label: `${label(labels, "shipTo", "Wysylka do")} ${index + 1}`, value: transport.shipTo ?? "-" },
      { label: `${label(labels, "shipThrough", "Wysylka przez")} ${index + 1}`, value: transport.shipThrough?.join(" / ") ?? "-" }
    ])
  ].filter((row) => row.value !== "-");
  if (!rows.length) return null;
  return (
    <DataSection title={labels.transactionTerms}>
      <KeyValueGrid rows={rows} />
    </DataSection>
  );
}

function FooterSection({
  invoice,
  labels,
  bilingual
}: {
  invoice: Invoice;
  labels: Record<string, string>;
  bilingual: boolean;
}) {
  if (!invoice.footer) return null;
  return (
    <div className="mt-6 border-t border-border pt-6 text-sm">
      <h3 className="mb-3 text-base font-semibold text-slate-950">{labels.footer}</h3>
      {invoice.footer.text ? (
        <div className="border-l-2 border-slate-300 pl-4">
          <p className="text-slate-700">{displayText(invoice.footer.translatedText, invoice.footer.text, bilingual)}</p>
        </div>
      ) : null}
      {invoice.footer.registry ? (
        <dl className="mt-4 grid gap-2 sm:grid-cols-4">
          <RegistryValue label={labels.registry} value={invoice.footer.registry.fullName} />
          <RegistryValue label={labels.krs} value={invoice.footer.registry.krs} />
          <RegistryValue label={labels.regon} value={invoice.footer.registry.regon} />
          <RegistryValue label={labels.bdo} value={invoice.footer.registry.bdo} />
        </dl>
      ) : null}
    </div>
  );
}

function VerificationSection({ invoice, labels }: { invoice: Invoice; labels: Record<string, string> }) {
  if (!invoice.verification?.ksefNumber && !invoice.verification?.qrLink) return null;
  return (
    <DataSection title={labels.verification}>
      <div className="grid gap-4 md:grid-cols-[140px_1fr]">
        <QrCodeImage value={invoice.verification.qrLink} />
        <KeyValueGrid
          rows={[
            { label: labels.ksefNumber, value: invoice.verification.ksefNumber ?? "-" },
            { label: labels.verificationLink, value: invoice.verification.qrLink ?? "-" }
          ].filter((row) => row.value !== "-")}
        />
      </div>
    </DataSection>
  );
}

function AttachmentsSection({ invoice, labels }: { invoice: Invoice; labels: Record<string, string> }) {
  if (!invoice.warehouseDocuments?.length && !invoice.attachments?.length) return null;
  return (
    <DataSection title={label(labels, "attachments", "Załączniki")}>
      <KeyValueGrid
        rows={[
          ...(invoice.warehouseDocuments ?? []).flatMap((document, index) => [
            { label: `${label(labels, "warehouseDocuments", "WZ")} ${index + 1}`, value: document.number ?? "-" },
            { label: `${labels.issueDate} ${index + 1}`, value: document.date ?? "-" }
          ]),
          ...(invoice.attachments ?? []).flatMap((attachment, index) => [
            { label: `${label(labels, "fileName", "Nazwa pliku")} ${index + 1}`, value: attachment.fileName ?? "-" },
            { label: `${labels.description} ${index + 1}`, value: attachment.description ?? "-" },
            { label: `Hash ${index + 1}`, value: attachment.hash ?? "-" }
          ])
        ].filter((row) => row.value !== "-")}
      />
    </DataSection>
  );
}

function BankAccounts({
  title,
  accounts,
  labels
}: {
  title: string;
  accounts: NonNullable<Invoice["payment"]>["bankAccounts"];
  labels: Record<string, string>;
}) {
  return (
    <DataSection title={title}>
      <div className="grid gap-4 md:grid-cols-2">
        {accounts?.map((account) => (
          <div key={account.accountNumber} className="border border-border p-4 text-sm">
            <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2">
              <dt className="text-slate-500">{labels.bankName}</dt>
              <dd className="font-medium">{account.bankName ?? "-"}</dd>
              <dt className="text-slate-500">{labels.accountNumber}</dt>
              <dd className="break-all font-medium">{account.accountNumber}</dd>
              <dt className="text-slate-500">{labels.swift}</dt>
              <dd>{account.swift ?? "-"}</dd>
              <dt className="text-slate-500">{labels.accountDescription}</dt>
              <dd>{account.description ?? "-"}</dd>
            </dl>
          </div>
        ))}
      </div>
    </DataSection>
  );
}

function QrCodeImage({ value }: { value?: string }) {
  const [dataUrl, setDataUrl] = useState<string>();

  useEffect(() => {
    let active = true;
    if (!value) {
      setDataUrl(undefined);
      return;
    }

    QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 1, width: 128 }).then((url) => {
      if (active) setDataUrl(url);
    });

    return () => {
      active = false;
    };
  }, [value]);

  if (!value) return null;

  return (
    <div className="flex h-32 w-32 items-center justify-center border border-border bg-white p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {dataUrl ? <img src={dataUrl} alt="KSeF verification QR code" className="h-full w-full" /> : null}
    </div>
  );
}

function OrdersTable({
  invoice,
  labels,
  bilingual
}: {
  invoice: Invoice;
  labels: Record<string, string>;
  bilingual: boolean;
}) {
  const orders = invoice.orders ?? [];
  const showContractNumber = orders.some((order) => order.contractNumber);
  const showOrderDate = orders.some((order) => order.orderDate);
  const showContractDate = orders.some((order) => order.contractDate);
  const showTotalValue = orders.some((order) => order.totalValue !== undefined);

  return (
    <div className="space-y-4">
      <div className="max-w-3xl">
        <p className="mb-1 text-sm font-semibold text-slate-950">{labels.orders}</p>
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-border p-2.5">{labels.orderNumber}</th>
                {showContractNumber ? <th className="border-b border-border p-2.5">{labels.contractNumber}</th> : null}
                {showOrderDate ? <th className="border-b border-border p-2.5">{label(labels, "orderDate", "Data zamowienia")}</th> : null}
                {showContractDate ? <th className="border-b border-border p-2.5">{label(labels, "contractDate", "Data umowy")}</th> : null}
                {showTotalValue ? <th className="border-b border-border p-2.5 text-right">{labels.totalValue}</th> : null}
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <tr key={`${order.orderNumber}-${index}`} className="border-b border-border last:border-0">
                  <td className="p-2.5 font-medium">{order.orderNumber ?? "-"}</td>
                  {showContractNumber ? <td className="p-2.5">{order.contractNumber ?? "-"}</td> : null}
                  {showOrderDate ? <td className="p-2.5">{order.orderDate ?? "-"}</td> : null}
                  {showContractDate ? <td className="p-2.5">{order.contractDate ?? "-"}</td> : null}
                  {showTotalValue ? <td className="p-2.5 text-right">{moneyOrDash(order.totalValue, invoice.currency)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {orders
        .filter((order) => order.lines?.length)
        .map((order, index) => (
          <div key={`${order.orderNumber}-lines-${index}`} className="overflow-x-auto border border-border">
            <table className="min-w-[1180px] w-full border-collapse text-sm">
              <caption className="bg-white p-2 text-left text-sm font-semibold text-slate-950">
                {labels.orders}: {order.orderNumber ?? index + 1}
              </caption>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-border p-3">{labels.line}</th>
                  <th className="border-b border-border p-3">{label(labels, "uniqueRowNumber", "UU ID")}</th>
                  <th className="border-b border-border p-3">{labels.index}</th>
                  <th className="border-b border-border p-3">{labels.description}</th>
                  <th className="border-b border-border p-3 text-right">{labels.unitPrice}</th>
                  <th className="border-b border-border p-3 text-right">{labels.quantity}</th>
                  <th className="border-b border-border p-3">{labels.unit}</th>
                  <th className="border-b border-border p-3">{labels.vatRate}</th>
                  <th className="border-b border-border p-3 text-right">{labels.netValue}</th>
                  <th className="border-b border-border p-3 text-right">{labels.vatTotal}</th>
                  <th className="border-b border-border p-3">GTIN</th>
                  <th className="border-b border-border p-3">GTU</th>
                  <th className="border-b border-border p-3">{label(labels, "procedure", "Procedura")}</th>
                </tr>
              </thead>
              <tbody>
                {order.lines?.map((line, lineIndex) => (
                  <tr key={`${line.name}-${lineIndex}`} className="border-b border-border last:border-0">
                    <td className="p-3">{line.lineNumber ?? "-"}</td>
                    <td className="p-3">{line.uniqueRowNumber ?? "-"}</td>
                    <td className="p-3">{line.index ?? "-"}</td>
                    <td className="p-3">
                      <div>{displayText(line.translatedName, line.name, bilingual)}</div>
                    </td>
                    <td className="p-3 text-right">{moneyOrDash(line.unitPrice, invoice.currency)}</td>
                    <td className="p-3 text-right">{line.quantity ?? "-"}</td>
                    <td className="p-3">{unitLabel(line.unit, line.translatedUnit, bilingual) || "-"}</td>
                    <td className="p-3">{line.vatRate ?? "-"}</td>
                    <td className="p-3 text-right">{moneyOrDash(line.netValue, invoice.currency)}</td>
                    <td className="p-3 text-right">{moneyOrDash(line.vatValue, invoice.currency)}</td>
                    <td className="p-3">{line.gtin ?? "-"}</td>
                    <td className="p-3">{line.gtu ?? "-"}</td>
                    <td className="p-3">{line.procedure ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}

function DataSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-6">
      <h3 className="mb-3 text-base font-semibold text-slate-950">{title}</h3>
      {children}
    </div>
  );
}

function KeyValueGrid({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-2 text-sm md:grid-cols-2">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="grid grid-cols-[160px_1fr] gap-3 border border-border p-3">
          <dt className="text-slate-500">{row.label}</dt>
          <dd className="break-all font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={strong ? "text-lg font-semibold text-slate-950" : "font-medium"}>{value}</dd>
    </div>
  );
}

function RegistryValue({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium">{value ?? "-"}</dd>
    </div>
  );
}

function unitLabel(original: string | undefined, translated: string | undefined, bilingual: boolean) {
  if (!original) return "";
  if (!bilingual) return translated || original;
  if (!translated || translated === original) return original;
  return `${translated} / ${original}`;
}

function invoiceTypeLabel(invoice: Invoice, labels: Record<string, string>, bilingual: boolean) {
  const translated =
    invoice.invoiceType === "ZAL"
      ? labels.invoiceTypeAdvance
      : invoice.invoiceType === "ROZ"
        ? labels.invoiceTypeFinal
        : invoice.invoiceType === "KOR"
          ? labels.invoiceTypeCorrection
          : invoice.invoiceType === "VAT"
            ? labels.invoiceTypeBasic
            : invoice.invoiceTypeLabel || invoice.invoiceType;

  if (!bilingual) return translated || invoice.invoiceType || "-";
  if (!invoice.invoiceType) return translated || "-";
  return `${translated || invoice.invoiceType} (${invoice.invoiceType})`;
}

function label(labels: Record<string, string>, key: string, fallback: string) {
  return labels[key] ?? fallback;
}

function serviceDateLabel(kind: InvoiceDetails["serviceDateKind"], labels: Record<string, string>) {
  return kind === "paymentReceived"
    ? label(labels, "paymentReceivedDate", "Data otrzymania zaplaty")
    : label(labels, "deliveryOrServiceDate", "Data dokonania lub zakonczenia dostawy towarow lub wykonania uslugi");
}

function servicePeriodValue(details: InvoiceDetails) {
  if (details.serviceDateFrom && details.serviceDateTo) return `${details.serviceDateFrom} - ${details.serviceDateTo}`;
  if (details.serviceDateFrom) return details.serviceDateFrom;
  if (details.serviceDateTo) return details.serviceDateTo;
  return undefined;
}

function paymentStatusLabel(status: NonNullable<Invoice["payment"]>["status"], labels: Record<string, string>) {
  if (status === "paid") return label(labels, "paidStatus", "Zapłacono");
  if (status === "paidInPart") return label(labels, "paidInPart", "Zapłacono częściowo");
  if (status === "paidAllInParts") return label(labels, "paidAllInParts", "Zapłacono w całości w częściach");
  return label(labels, "noPayment", "Brak zapłaty");
}

function displayText(translated: string | undefined, original: string | undefined, bilingual: boolean) {
  if (!translated && !original) return "-";
  if (!bilingual) return translated || original || "-";
  if (!translated || translated === original) return original || translated || "-";
  return (
    <>
      <span>{translated}</span>
      <span className="mt-1 block text-xs text-slate-500">{original}</span>
    </>
  );
}

function displayPlainText(translated: string | undefined, original: string | undefined, bilingual: boolean) {
  if (!translated && !original) return "";
  if (!bilingual) return translated || original || "";
  if (!translated || translated === original) return original || translated || "";
  return `${translated} / ${original}`;
}

function moneyOrDash(value: number | undefined, currency: string) {
  return value === undefined ? "-" : formatMoney(value, currency);
}
