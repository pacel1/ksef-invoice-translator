"use client";

import { useEffect, useState } from "react";
import type React from "react";
import QRCode from "qrcode";
import type { Invoice, LanguageCode } from "@/types/invoice";
import { getBilingualLabels, getLabels } from "@/lib/translation/dictionaries";
import { formatMoney } from "@/lib/invoice/format";

export function InvoicePreview({
  invoice,
  language,
  bilingual
}: {
  invoice: Invoice;
  language: LanguageCode;
  bilingual: boolean;
}) {
  const labels = bilingual ? getBilingualLabels(language) : getLabels(language);
  const showIndex = invoice.items.some((item) => item.index);

  return (
    <section className="border border-border bg-white p-5 shadow-soft md:p-8">
      <div className="flex flex-col gap-6 border-b border-border pb-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">KSeF Invoice Translator</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{labels.invoice}</h2>
        </div>
        <dl className="grid min-w-72 grid-cols-[1fr_auto] gap-x-5 gap-y-2 text-sm">
          <dt className="text-slate-500">{labels.invoiceNumber}</dt>
          <dd className="font-medium">{invoice.invoiceNumber}</dd>
          {invoice.invoiceType || invoice.invoiceTypeLabel ? (
            <>
              <dt className="text-slate-500">{labels.invoiceType}</dt>
              <dd className="font-medium">{invoiceTypeLabel(invoice, labels, bilingual)}</dd>
            </>
          ) : null}
          <dt className="text-slate-500">{labels.issueDate}</dt>
          <dd>{invoice.issueDate}</dd>
          <dt className="text-slate-500">{labels.saleDate}</dt>
          <dd>{invoice.saleDate ?? "-"}</dd>
          <dt className="text-slate-500">{labels.currency}</dt>
          <dd>{invoice.currency}</dd>
        </dl>
      </div>

      <div className="grid gap-4 py-6 md:grid-cols-2">
        <PartyCard title={labels.seller} party={invoice.seller} vatLabel={labels.vatId} />
        <PartyCard title={labels.buyer} party={invoice.buyer} vatLabel={labels.vatId} />
      </div>

      <div className="overflow-x-auto border border-border">
        <table className={showIndex ? "min-w-[980px] w-full border-collapse text-sm" : "min-w-[900px] w-full border-collapse text-sm"}>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {showIndex ? <th className="border-b border-border p-3">{labels.index}</th> : null}
              <th className="border-b border-border p-3">{labels.description}</th>
              <th className="border-b border-border p-3 text-right">{labels.quantity}</th>
              <th className="border-b border-border p-3 text-right">{labels.unitPrice}</th>
              <th className="border-b border-border p-3 text-right">{labels.vatRate}</th>
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
                <td className="p-3 text-right">{formatMoney(item.netValue, invoice.currency)}</td>
                <td className="p-3 text-right">{formatMoney(item.grossValue, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 pt-6 md:grid-cols-[1fr_320px]">
        <div className="text-sm">
          <h3 className="mb-3 text-base font-semibold text-slate-950">{labels.payment}</h3>
          <p><span className="text-slate-500">{labels.dueDate}:</span> {invoice.payment?.dueDate ?? "-"}</p>
          <p><span className="text-slate-500">{labels.method}:</span> {invoice.payment?.methodLabel ?? invoice.payment?.method ?? "-"}</p>
          <p><span className="text-slate-500">{labels.paid}:</span> {invoice.payment?.isPaid ?? "-"}</p>
          <p><span className="text-slate-500">{labels.paidDate}:</span> {invoice.payment?.paidDate ?? "-"}</p>
          {invoice.notes ? (
            <div className="mt-4 border-l-2 border-cyan-700 pl-4">
              <p className="font-medium">{labels.notes}</p>
              <p className="whitespace-pre-line text-slate-600">{displayText(invoice.translatedNotes, invoice.notes, bilingual)}</p>
            </div>
          ) : null}
        </div>
        <dl className="space-y-3 border-t-2 border-cyan-700 pt-4 text-sm">
          <TotalRow label={labels.netTotal} value={formatMoney(invoice.totals.net, invoice.currency)} />
          <TotalRow label={labels.vatTotal} value={formatMoney(invoice.totals.vat, invoice.currency)} />
          <TotalRow label={labels.grossTotal} value={formatMoney(invoice.totals.gross, invoice.currency)} strong />
        </dl>
      </div>

      {invoice.taxBreakdown?.length ? (
        <DataSection title={labels.taxSummary}>
          <div className="overflow-x-auto border border-border">
            <table className="min-w-[720px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-border p-3">{labels.description}</th>
                  <th className="border-b border-border p-3 text-right">{labels.netValue}</th>
                  <th className="border-b border-border p-3 text-right">{labels.vatTotal}</th>
                  <th className="border-b border-border p-3 text-right">VAT PLN</th>
                </tr>
              </thead>
              <tbody>
                {invoice.taxBreakdown.map((line) => (
                  <tr key={line.code} className="border-b border-border last:border-0">
                    <td className="p-3">{line.label}</td>
                    <td className="p-3 text-right">{moneyOrDash(line.net, invoice.currency)}</td>
                    <td className="p-3 text-right">{moneyOrDash(line.vat, invoice.currency)}</td>
                    <td className="p-3 text-right">{moneyOrDash(line.vatInPln, "PLN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataSection>
      ) : null}

      {invoice.payment?.bankAccounts?.length ? (
        <BankAccounts title={labels.bankAccounts} accounts={invoice.payment.bankAccounts} labels={labels} />
      ) : null}

      {invoice.payment?.factorBankAccounts?.length ? (
        <BankAccounts title={labels.factorBankAccounts} accounts={invoice.payment.factorBankAccounts} labels={labels} />
      ) : null}

      {invoice.payment?.paymentTerms?.length ? (
        <DataSection title={labels.paymentTerms}>
          <KeyValueGrid
            rows={invoice.payment.paymentTerms.map((term, index) => ({
              label: `${labels.dueDate} ${index + 1}`,
              value: [term.dueDate, term.description].filter(Boolean).join(" - ") || "-"
            }))}
          />
        </DataSection>
      ) : null}

      {invoice.payment?.partialPayments?.length ? (
        <DataSection title={labels.partialPayments}>
          <KeyValueGrid
            rows={invoice.payment.partialPayments.flatMap((payment, index) => [
              { label: `${labels.amount} ${index + 1}`, value: moneyOrDash(payment.amount, invoice.currency) },
              { label: `${labels.paidDate} ${index + 1}`, value: payment.date ?? "-" },
              { label: `${labels.method} ${index + 1}`, value: payment.method ?? payment.otherMethodDescription ?? "-" }
            ])}
          />
        </DataSection>
      ) : null}

      {invoice.additionalDescriptions?.length ? (
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
                    <td className="p-3">
                      <div>{displayText(entry.translatedKey, entry.key, bilingual)}</div>
                    </td>
                    <td className="p-3">
                      <div>{displayText(entry.translatedValue, entry.value, bilingual)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataSection>
      ) : null}

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

      {invoice.settlements ? (
        <DataSection title={labels.settlements}>
          <KeyValueGrid
            rows={[
              ...(invoice.settlements.charges ?? []).map((line, index) => ({
                label: `${labels.charges} ${index + 1}`,
                value: `${moneyOrDash(line.amount, invoice.currency)} ${displayPlainText(line.translatedReason, line.reason, bilingual)}`.trim()
              })),
              ...(invoice.settlements.deductions ?? []).map((line, index) => ({
                label: `${labels.deductions} ${index + 1}`,
                value: `${moneyOrDash(line.amount, invoice.currency)} ${displayPlainText(line.translatedReason, line.reason, bilingual)}`.trim()
              })),
              { label: labels.amountToSettle, value: moneyOrDash(invoice.settlements.amountToSettle, invoice.currency) }
            ]}
          />
        </DataSection>
      ) : null}

      {invoice.orders?.length ? (
        <DataSection title={labels.transactionTerms ?? labels.orders}>
          <OrdersTable invoice={invoice} labels={labels} bilingual={bilingual} />
        </DataSection>
      ) : null}

      {invoice.footer ? (
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
      ) : null}

      {invoice.verification?.ksefNumber || invoice.verification?.qrLink ? (
        <DataSection title={labels.verification}>
          <div className="grid gap-4 md:grid-cols-[140px_1fr]">
            <QrCodeImage value={invoice.verification.qrLink} />
            <KeyValueGrid
              rows={[
                { label: labels.ksefNumber, value: invoice.verification.ksefNumber ?? "-" },
                { label: labels.verificationLink, value: invoice.verification.qrLink ?? "-" }
              ]}
            />
          </div>
        </DataSection>
      ) : null}
    </section>
  );
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
                {showTotalValue ? <th className="border-b border-border p-2.5 text-right">{labels.totalValue}</th> : null}
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <tr key={`${order.orderNumber}-${index}`} className="border-b border-border last:border-0">
                  <td className="p-2.5 font-medium">{order.orderNumber ?? "-"}</td>
                  {showContractNumber ? <td className="p-2.5">{order.contractNumber ?? "-"}</td> : null}
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
            <table className="min-w-[820px] w-full border-collapse text-sm">
              <caption className="bg-white p-2 text-left text-sm font-semibold text-slate-950">
                {labels.orders}: {order.orderNumber ?? index + 1}
              </caption>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-border p-3">{labels.line}</th>
                  <th className="border-b border-border p-3">{labels.index}</th>
                  <th className="border-b border-border p-3">{labels.description}</th>
                  <th className="border-b border-border p-3 text-right">{labels.quantity}</th>
                  <th className="border-b border-border p-3 text-right">{labels.netValue}</th>
                </tr>
              </thead>
              <tbody>
                {order.lines?.map((line, lineIndex) => (
                  <tr key={`${line.name}-${lineIndex}`} className="border-b border-border last:border-0">
                    <td className="p-3">{line.lineNumber ?? "-"}</td>
                    <td className="p-3">{line.index ?? "-"}</td>
                    <td className="p-3">
                      <div>{displayText(line.translatedName, line.name, bilingual)}</div>
                    </td>
                    <td className="p-3 text-right">{line.quantity ?? "-"} {unitLabel(line.unit, line.translatedUnit, bilingual)}</td>
                    <td className="p-3 text-right">{moneyOrDash(line.netValue, invoice.currency)}</td>
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
