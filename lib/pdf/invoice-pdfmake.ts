import pdfMake from "pdfmake";
import QRCode from "qrcode";
import path from "node:path";
import type {
  Content,
  ContentTable,
  Node as PdfNode,
  NodeQueries,
  StyleDictionary,
  TDocumentDefinitions,
  TableCell
} from "pdfmake/interfaces";
import type { BankAccount, Invoice, InvoiceDetails, LanguageCode } from "@/types/invoice";
import { getBilingualLabels, getLabels } from "@/lib/translation/dictionaries";
import { formatMoney } from "@/lib/invoice/format";
import { MF_FA3_SECTION_ORDER, type MfFa3SectionId } from "@/lib/mf-fa3/sections";

type Row = Record<string, string | number | undefined>;
type DataTableHeader = {
  key: string;
  label: string;
  width: string | number;
  alignment?: "left" | "right" | "center" | "justify";
  fontSize?: number;
};
type PdfMakeWithPolicies = typeof pdfMake & {
  setLocalAccessPolicy?: (policy: (path: string) => boolean) => void;
  setUrlAccessPolicy?: (policy: (url: string) => boolean) => void;
};

const fontDirectory = "node_modules/pdfmake/fonts/Roboto";
const resolvedFontDirectory = path.join(process.cwd(), fontDirectory);

const fonts = {
  Roboto: {
    normal: path.join(resolvedFontDirectory, "Roboto-Regular.ttf"),
    bold: path.join(resolvedFontDirectory, "Roboto-Medium.ttf"),
    italics: path.join(resolvedFontDirectory, "Roboto-Italic.ttf"),
    bolditalics: path.join(resolvedFontDirectory, "Roboto-MediumItalic.ttf")
  }
};

const styles: StyleDictionary = {
  title: { fontSize: 18, bold: true, color: "#1f2937" },
  subtitle: { fontSize: 8, color: "#0e7490" },
  sectionHeader: { fontSize: 10, bold: true, color: "#1f2937", margin: [0, 8, 0, 6] },
  cardHeader: { fontSize: 9, bold: true, color: "#155e75" },
  partyName: { fontSize: 9, bold: true, color: "#020617" },
  label: { bold: true, color: "#343a40" },
  muted: { color: "#64748b", fontSize: 7 },
  tableHeader: { bold: true, fillColor: "#f1f5f9", color: "#343a40" },
  total: { bold: true, fontSize: 10 }
};

export async function renderInvoicePdfMake(invoice: Invoice, language: LanguageCode, bilingual = true) {
  const pdfMakeServer = pdfMake as PdfMakeWithPolicies;
  pdfMakeServer.setLocalAccessPolicy?.((filePath) => filePath.replaceAll("\\", "/").includes(fontDirectory));
  pdfMakeServer.setUrlAccessPolicy?.(() => false);
  pdfMake.setFonts(fonts);
  const verificationQr = invoice.verification?.qrLink
    ? await QRCode.toDataURL(invoice.verification.qrLink, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 128
      })
    : undefined;
  const definition = createInvoiceDocument(invoice, language, bilingual, verificationQr);
  return pdfMake.createPdf(definition).getBuffer();
}

function createInvoiceDocument(invoice: Invoice, language: LanguageCode, bilingual: boolean, verificationQr?: string): TDocumentDefinitions {
  const labels = bilingual ? getBilingualLabels(language) : getLabels(language);
  const content: Content[] = [
    ...MF_FA3_SECTION_ORDER.flatMap((sectionId) => pdfSection(sectionId, invoice, labels, bilingual, verificationQr)),
    {
      text: labels.translatedRepresentation,
      style: "muted",
      margin: [0, 16, 0, 0]
    }
  ];

  return {
    pageSize: "A4",
    pageMargins: [26, 30, 26, 42],
    info: {
      title: `${labels.invoice} ${invoice.invoiceNumber}`,
      author: "KSeF Invoice Translator",
      subject: "Translated human-readable KSeF invoice"
    },
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `KSeF Invoice Translator`, style: "muted" },
        { text: `${currentPage} / ${pageCount}`, alignment: "right", style: "muted" }
      ],
      margin: [26, 0, 26, 0]
    }),
    pageBreakBefore: avoidOrphanedSectionHeader,
    styles,
    defaultStyle: {
      font: "Roboto",
      fontSize: 8,
      lineHeight: 1.15
    }
  };
}

function pdfSection(
  sectionId: MfFa3SectionId,
  invoice: Invoice,
  labels: Record<string, string>,
  bilingual: boolean,
  verificationQr?: string
): Content[] {
  switch (sectionId) {
    case "header":
      return [header(invoice, labels, bilingual)];
    case "correctedInvoiceData":
      return optionalSection(label(labels, "correctedInvoiceData", "Corrected invoice data"), correctionContent(invoice, labels));
    case "parties":
      return [
        partyCardsRow(labels, invoice),
        ...optionalSection(label(labels, "thirdParties", "Additional parties"), partiesContent(invoice.thirdParties ?? [], labels)),
        ...optionalSection(label(labels, "authorizedParty", "Authorized party"), invoice.authorizedParty ? partiesContent([invoice.authorizedParty], labels) : [])
      ];
    case "details":
      return optionalSection(label(labels, "details", "Details"), detailsContent(invoice, labels));
    case "rowsOrDiscount":
      return [rowsOrDiscountSection(invoice, labels, bilingual)];
    case "orders":
      return optionalSection(labels.orders, ordersContent(invoice, labels, bilingual));
    case "taxSummary":
      return optionalSection(labels.taxSummary, taxSummaryContent(invoice, labels));
    case "annotations":
      return optionalSection(label(labels, "annotations", "Annotations"), annotationsContent(invoice, labels));
    case "additionalInformation":
      return optionalSection(labels.additionalInformation, additionalDescriptionsContent(invoice, labels, bilingual));
    case "settlements":
      return optionalSection(labels.settlements, settlementsContent(invoice, labels, bilingual));
    case "payment":
      return [...optionalSection(labels.payment, paymentContent(invoice, labels)), ...bankAccountsSections(invoice, labels)];
    case "transactionTerms":
      return optionalSection(labels.transactionTerms ?? label(labels, "transactionTerms", "Transaction terms"), transactionTermsContent(invoice, labels));
    case "footer":
      return optionalSection(labels.footer, footerContent(invoice, labels, bilingual));
    case "attachments":
      return optionalSection(label(labels, "attachments", "Attachments"), attachmentsContent(invoice, labels));
    case "verification":
      return optionalSection(labels.verification, verificationContent(invoice, labels, verificationQr));
  }
}

function header(invoice: Invoice, labels: Record<string, string>, bilingual: boolean): Content {
  return {
    stack: [
      {
        columns: [
          {
            stack: [
              { text: "KSeF Invoice Translator", style: "subtitle" },
              { text: labels.invoice, style: "title", margin: [0, 3, 0, 0] }
            ],
            width: "*"
          },
          {
            table: {
              widths: ["*", "auto"],
              body: keyValueRows(
                [
                  [labels.invoiceNumber, invoice.invoiceNumber],
                  ...(invoice.invoiceType || invoice.invoiceTypeLabel ? [[labels.invoiceType, invoiceTypeLabel(invoice, labels, bilingual)]] as [string, string][] : []),
                  [labels.issueDate, invoice.issueDate],
                  [labels.saleDate, invoice.saleDate ?? "-"],
                  [labels.currency, invoice.currency]
                ],
                "right"
              )
            },
            layout: "noBorders",
            width: 240
          }
        ]
      },
      line()
    ],
    margin: [0, 0, 0, 14]
  };
}

function sectionStack(title: string, stack: Content[]): Content[] {
  return [
    {
      stack: [line(), { text: title, style: "sectionHeader", headlineLevel: 1 }],
      headlineLevel: 1,
      unbreakable: true
    },
    ...stack
  ];
}

function partyCard(title: string, party: Invoice["seller"], labels: Record<string, string>): Content {
  const stack: Content[] = [
    { text: title, style: "cardHeader", margin: [0, 0, 0, 8] },
    { text: party.name, style: "partyName", margin: [0, 0, 0, 6] },
    { text: `${labels.vatId}: ${party.vatId ?? "-"}`, color: "#475569", margin: [0, 0, 0, 3] },
    { text: party.address ?? "-", color: "#475569" }
  ];

  if (party.customerNumber) {
    stack.push({ text: `${labels.customerNumber ?? "Customer number"}: ${party.customerNumber}`, color: "#475569", margin: [0, 3, 0, 0] });
  }

  if (party.role) {
    stack.push({ text: `${labels.role ?? "Role"}: ${party.role}`, color: "#475569", margin: [0, 3, 0, 0] });
  }

  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack,
            margin: [10, 10, 10, 10]
          }
        ]
      ]
    },
    layout: cardLayout(),
    unbreakable: true
  };
}

function partyCardsRow(labels: Record<string, string>, invoice: Invoice): Content {
  return {
    table: {
      widths: ["*", "*"],
      body: [
        [
          partyCardCell(labels.seller, invoice.seller, labels),
          partyCardCell(labels.buyer, invoice.buyer, labels)
        ]
      ]
    },
    layout: cardLayout(),
    margin: [0, 0, 0, 14],
    unbreakable: true
  };
}

function partyCardCell(title: string, party: Invoice["seller"], labels: Record<string, string>): TableCell {
  const stack = partyStack(title, party, labels);
  return {
    stack,
    margin: [10, 10, 10, 10]
  };
}

function partyStack(title: string, party: Invoice["seller"], labels: Record<string, string>): Content[] {
  const stack: Content[] = [
    { text: title, style: "cardHeader", margin: [0, 0, 0, 8] },
    { text: party.name, style: "partyName", margin: [0, 0, 0, 6] },
    { text: `${labels.vatId}: ${party.vatId ?? "-"}`, color: "#475569", margin: [0, 0, 0, 3] },
    { text: party.address ?? "-", color: "#475569" }
  ];

  if (party.customerNumber) {
    stack.push({ text: `${labels.customerNumber ?? "Customer number"}: ${party.customerNumber}`, color: "#475569", margin: [0, 3, 0, 0] });
  }

  if (party.role) {
    stack.push({ text: `${labels.role ?? "Role"}: ${party.role}`, color: "#475569", margin: [0, 3, 0, 0] });
  }

  return stack;
}

function section(title: string, stack: Content[]): Content {
  return {
    stack: sectionStack(title, stack),
    margin: [0, 4, 0, 8]
  };
}

function optionalSection(title: string, stack: Content[]): Content[] {
  return stack.length ? [section(title, stack)] : [];
}

function rowsOrDiscountSection(invoice: Invoice, labels: Record<string, string>, bilingual: boolean): Content {
  if (invoice.correction?.isCollectiveDiscount) {
    return section(label(labels, "discountCorrection", "Discount correction"), discountCorrectionContent(invoice, labels));
  }
  return section(labels.description, [itemsTable(invoice, labels, bilingual), totalDueContent(invoice, labels)]);
}

function detailsContent(invoice: Invoice, labels: Record<string, string>): Content[] {
  const details = invoice.details;
  if (!details) return [];

  const rows: [string, string][] = [
    [label(labels, "issueDateWithKsefClause", "Issue date, subject to art. 106na sec. 1 of the VAT Act"), invoice.issueDate],
    [label(labels, "issuePlace", "Issue place"), details.issuePlace ?? "-"],
    [label(labels, "discountPeriod", "Discount period"), details.discountPeriod ?? "-"],
    [serviceDateLabel(details.serviceDateKind, labels), details.serviceDate ?? invoice.saleDate ?? "-"],
    [label(labels, "servicePeriod", "Delivery/service period"), servicePeriodValue(details) ?? "-"],
    [label(labels, "currencyCode", "Currency code"), details.currencyCode ?? invoice.currency],
    [label(labels, "ossProcedure", "OSS procedure"), details.hasOssProcedure ? label(labels, "yes", "Yes") : "-"],
    [label(labels, "commonCurrencyRateApplies", "Currency rate common to all invoice rows"), details.commonCurrencyRateApplies ? label(labels, "yes", "Yes") : "-"],
    [label(labels, "currencyRate", "Currency rate"), details.commonCurrencyRate ?? "-"]
  ].filter(([, value]) => value !== "-") as [string, string][];

  const content: Content[] = rows.length ? [keyValueCard(rows)] : [];

  if (details.partialAdvances?.length) {
    content.push(
      { text: label(labels, "partialAdvances", "Partial advances"), style: "sectionHeader" },
      dataTable(
        [
          { key: "date", label: labels.paidDate, width: 80 },
          { key: "amount", label: labels.amount, width: 80, alignment: "right" },
          { key: "currencyRate", label: label(labels, "currencyRate", "Currency rate"), width: "*" }
        ],
        details.partialAdvances.map((advance) => ({
          date: advance.date ?? "-",
          amount: moneyOrDash(advance.amount, invoice.currency),
          currencyRate: advance.currencyRate
        }))
      )
    );
  }

  if (details.advanceInvoices?.length) {
    content.push(
      { text: label(labels, "advanceInvoices", "Advance invoices"), style: "sectionHeader" },
      dataTable(
        [
          { key: "number", label: labels.invoiceNumber, width: "*" },
          { key: "ksefNumber", label: labels.ksefNumber, width: "*" }
        ],
        details.advanceInvoices.map((advance) => ({
          number: advance.number,
          ksefNumber: advance.ksefNumber
        }))
      )
    );
  }

  return content;
}

function correctionContent(invoice: Invoice, labels: Record<string, string>): Content[] {
  const correction = invoice.correction;
  if (!correction) return [];

  const content: Content[] = [];
  const rows: [string, string][] = [
    [label(labels, "correctedInvoiceNumber", "Corrected invoice number"), correction.correctedInvoiceNumber ?? "-"],
    [labels.reason, correction.reason ?? "-"],
    [label(labels, "correctionType", "Correction type"), correction.type ?? "-"],
    [label(labels, "correctionPeriod", "Correction period"), correction.period ?? "-"]
  ].filter(([, value]) => value !== "-") as [string, string][];

  if (rows.length) content.push(keyValueCard(rows));

  if (correction.references?.length) {
    content.push(
      dataTable(
        [
          { key: "issueDate", label: labels.issueDate, width: 80 },
          { key: "invoiceNumber", label: labels.invoiceNumber, width: "*" },
          { key: "ksefNumber", label: labels.ksefNumber, width: "*" }
        ],
        correction.references.map((reference) => ({
          issueDate: reference.issueDate,
          invoiceNumber: reference.invoiceNumber,
          ksefNumber: reference.ksefNumber
        }))
      )
    );
  }

  return content;
}

function discountCorrectionContent(invoice: Invoice, labels: Record<string, string>): Content[] {
  const showLineNumber = invoice.items.some((item) => item.lineNumber);
  const appliesText = showLineNumber
    ? label(labels, "discountAppliesSelectedRows", "Discount does not apply to all supplies of goods and services made to this buyer in the given period.")
    : label(labels, "discountAppliesAllRows", "Discount applies to all supplies of goods and services made to this buyer in the given period.");
  return [
    keyValueCard([
      [label(labels, "totalDiscountCorrectionValue", "Total discount value"), formatMoney(invoice.totals.gross, invoice.currency)],
      [label(labels, "correctionPeriod", "Correction period"), invoice.correction?.period ?? "-"]
    ]),
    { text: appliesText, margin: [0, 4, 0, 6] },
    dataTable(
      [
        ...(showLineNumber ? [{ key: "lineNumber", label: labels.line, width: 32, fontSize: 7 }] : []),
        { key: "name", label: labels.description, width: "*" },
        { key: "quantity", label: labels.quantity, width: 58, alignment: "right", fontSize: 7 },
        { key: "unit", label: labels.unit, width: 40, fontSize: 7 }
      ],
      invoice.items.map((item) => ({
        lineNumber: item.lineNumber,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit
      }))
    )
  ];
}

function itemsTable(invoice: Invoice, labels: Record<string, string>, bilingual: boolean): Content {
  const showIndex = invoice.items.some((item) => item.index);
  const showLineNumber = invoice.items.some((item) => item.lineNumber);
  const showUniqueRowNumber = invoice.items.some((item) => item.uniqueRowNumber);
  const rowRates = Array.from(new Set(invoice.items.map((item) => item.currencyRate).filter(Boolean)));
  const showCurrencyRate = rowRates.length > 1;
  const headers = [
    ...(showLineNumber ? [{ key: "lineNumber", label: labels.line, width: 24, fontSize: 7 }] : []),
    ...(showUniqueRowNumber ? [{ key: "uniqueRowNumber", label: "UU_ID", width: 34, fontSize: 7 }] : []),
    ...(showIndex ? [{ key: "index", label: labels.index, width: 24, fontSize: 7 }] : []),
    { key: "name", label: labels.description, width: "*" },
    { key: "quantity", label: labels.quantity, width: 48, alignment: "right", fontSize: 7 },
    { key: "unitPrice", label: labels.unitPrice, width: 56, alignment: "right", fontSize: 7 },
    { key: "grossUnitPrice", label: label(labels, "grossUnitPrice", "Gross unit price"), width: 56, alignment: "right", fontSize: 7 },
    { key: "discount", label: label(labels, "discount", "Discount"), width: 44, alignment: "right", fontSize: 7 },
    { key: "vatRate", label: labels.vatRate, width: 34, alignment: "right", fontSize: 7 },
    { key: "ossVatRate", label: label(labels, "ossVatRate", "OSS VAT"), width: 42, alignment: "right", fontSize: 7 },
    { key: "productMarker", label: label(labels, "productMarker", "Marker"), width: 42, fontSize: 7 },
    { key: "netValue", label: labels.netValue, width: 56, alignment: "right", fontSize: 7 },
    { key: "vatValue", label: labels.vatTotal, width: 56, alignment: "right", fontSize: 7 },
    { key: "grossValue", label: labels.grossValue, width: 58, alignment: "right", fontSize: 7 },
    ...(showCurrencyRate ? [{ key: "currencyRate", label: label(labels, "currencyRate", "Currency rate"), width: 52, alignment: "right", fontSize: 7 }] : []),
    { key: "stateBefore", label: label(labels, "stateBefore", "Before"), width: 36, fontSize: 7 },
    { key: "gtin", label: "GTIN", width: 48, fontSize: 7 },
    { key: "pkwiu", label: "PKWiU", width: 48, fontSize: 7 },
    { key: "cn", label: "CN", width: 40, fontSize: 7 },
    { key: "pkob", label: "PKOB", width: 42, fontSize: 7 },
    { key: "exciseTaxAmount", label: label(labels, "exciseTaxAmount", "Excise"), width: 48, alignment: "right", fontSize: 7 },
    { key: "gtu", label: "GTU", width: 36, fontSize: 7 },
    { key: "procedure", label: label(labels, "procedure", "Procedure"), width: 70, fontSize: 7 },
    { key: "receiptDate", label: label(labels, "receiptDate", "Receipt date"), width: 58, fontSize: 7 }
  ] as DataTableHeader[];
  const rows = invoice.items.map((item) => ({
    lineNumber: item.lineNumber,
    uniqueRowNumber: item.uniqueRowNumber,
    index: item.index,
    name: displayText(item.translatedName, item.name, bilingual),
    quantity: `${item.quantity} ${unitLabel(item.unit, item.translatedUnit, bilingual)}`,
    unitPrice: formatMoney(item.unitPrice, invoice.currency),
    grossUnitPrice: moneyOrDash(item.grossUnitPrice, invoice.currency),
    discount: moneyOrDash(item.discount, invoice.currency),
    vatRate: item.vatRate,
    ossVatRate: item.ossVatRate,
    productMarker: item.productMarker,
    netValue: formatMoney(item.netValue, invoice.currency),
    vatValue: moneyOrDash(item.vatValue, invoice.currency),
    grossValue: formatMoney(item.grossValue, invoice.currency),
    currencyRate: item.currencyRate,
    stateBefore: item.stateBefore,
    gtin: item.gtin,
    pkwiu: item.pkwiu,
    cn: item.cn,
    pkob: item.pkob,
    exciseTaxAmount: moneyOrDash(item.exciseTaxAmount, invoice.currency),
    gtu: item.gtu,
    procedure: item.procedure,
    receiptDate: item.receiptDate
  }));
  return dataTable(headers, rows);
}

function totalDueContent(invoice: Invoice, labels: Record<string, string>): Content {
  const labelKey = invoice.invoiceType === "ROZ" ? "remainingAmount" : "totalAmountDue";
  return {
    text: `${label(labels, labelKey, invoice.invoiceType === "ROZ" ? "Remaining amount" : "Total amount due")}: ${formatMoney(invoice.totals.gross, invoice.currency)}`,
    alignment: "right",
    bold: true,
    fontSize: 10,
    margin: [0, 8, 0, 0]
  };
}

function taxSummaryTable(invoice: Invoice, labels: Record<string, string>): Content {
  const showVatInPln = invoice.taxBreakdown?.some((line) => line.vatInPln !== undefined) ?? false;
  return dataTable(
    [
      { key: "code", label: "Lp.", width: 28, fontSize: 7 },
      { key: "label", label: label(labels, "taxRate", "Tax rate"), width: "*" },
      { key: "net", label: labels.netValue, width: 68, alignment: "right", fontSize: 7 },
      { key: "vat", label: labels.vatTotal, width: 68, alignment: "right", fontSize: 7 },
      { key: "gross", label: labels.grossValue, width: 68, alignment: "right", fontSize: 7 },
      ...(showVatInPln ? [{ key: "vatInPln", label: "VAT PLN", width: 68, alignment: "right" as const, fontSize: 7 }] : [])
    ] as DataTableHeader[],
    (invoice.taxBreakdown ?? []).map((line) => ({
      code: line.code,
      label: line.label,
      net: moneyOrDash(line.net, invoice.currency),
      vat: moneyOrDash(line.vat, invoice.currency),
      gross: moneyOrDash(line.gross, invoice.currency),
      vatInPln: moneyOrDash(line.vatInPln, "PLN")
    }))
  );
}

function taxSummaryContent(invoice: Invoice, labels: Record<string, string>): Content[] {
  return invoice.taxBreakdown?.length ? [taxSummaryTable(invoice, labels)] : [];
}

function paymentContent(invoice: Invoice, labels: Record<string, string>): Content[] {
  const payment = invoice.payment;
  if (!payment) return [];
  const stack: Content[] = [
    keyValueTable([
      [label(labels, "paymentInformation", "Payment information"), paymentStatusLabel(payment.status, labels)],
      [labels.dueDate, payment.dueDate ?? "-"],
      [labels.method, payment.methodLabel ?? payment.method ?? "-"],
      [labels.paidDate, payment.paidDate ?? "-"],
      [labels.accountDescription, payment.otherMethodDescription ?? "-"],
      ["Link", payment.paymentLink ?? "-"],
      ["IP KSeF", payment.ipKsef ?? "-"]
    ].filter(([, value]) => value !== "-") as [string, string][])
  ];

  if (payment.paymentTerms?.length) {
    stack.push({ text: labels.paymentTerms, style: "sectionHeader" });
    stack.push(
      dataTable(
        [
          { key: "dueDate", label: labels.dueDate, width: 70 },
          { key: "description", label: labels.description, width: "*" }
        ],
        payment.paymentTerms.map((term) => ({
          dueDate: term.dueDate ?? "-",
          description: term.description ?? "-"
        }))
      )
    );
  }

  if (payment.partialPayments?.length) {
    stack.push({ text: labels.partialPayments, style: "sectionHeader" });
    stack.push(
      dataTable(
        [
          { key: "date", label: labels.paidDate, width: 70 },
          { key: "amount", label: labels.amount, width: 70, alignment: "right", fontSize: 7 },
          { key: "method", label: labels.method, width: "*" }
        ],
        payment.partialPayments.map((partial) => ({
          date: partial.date ?? "-",
          amount: moneyOrDash(partial.amount, invoice.currency),
          method: partial.method ?? partial.otherMethodDescription ?? "-"
        }))
      )
    );
  }

  if (payment.discounts?.length) {
    stack.push({ text: label(labels, "conditionalDiscount", "Conditional discount"), style: "sectionHeader" });
    stack.push(
      dataTable(
        [
          { key: "conditions", label: label(labels, "discountConditions", "Discount conditions"), width: "*" },
          { key: "amount", label: label(labels, "discountAmount", "Discount amount"), width: 80, alignment: "right", fontSize: 7 }
        ],
        payment.discounts.map((discount) => ({
          conditions: discount.conditions ?? "-",
          amount: moneyOrDash(discount.amount, invoice.currency)
        }))
      )
    );
  }

  return stack;
}

function bankAccountsSections(invoice: Invoice, labels: Record<string, string>): Content[] {
  const payment = invoice.payment;
  if (!payment) return [];
  return [
    ...optionalSection(labels.bankAccounts, bankAccountContent(payment.bankAccounts ?? [], labels)),
    ...optionalSection(labels.factorBankAccounts, bankAccountContent(payment.factorBankAccounts ?? [], labels))
  ];
}

function bankAccountContent(accounts: BankAccount[], labels: Record<string, string>): Content[] {
  if (!accounts.length) return [];
  const columnCount = Math.min(accounts.length, 3);
  const rows: TableCell[][] = [];
  for (let index = 0; index < accounts.length; index += columnCount) {
    const rowAccounts = accounts.slice(index, index + columnCount);
    const row = rowAccounts.map((account) =>
      keyValueCardCell([
        [labels.bankName, account.bankName ?? "-"],
        [labels.accountNumber, account.accountNumber],
        [labels.swift, account.swift ?? "-"],
        [labels.accountDescription, account.description ?? "-"]
      ])
    );

    while (row.length < columnCount) {
      row.push({ text: "", border: [false, false, false, false] });
    }

    rows.push(row);
  }

  return [
    {
      table: {
        widths: Array.from({ length: columnCount }, () => "*"),
        body: rows
      },
      layout: spacedCardGridLayout(),
      unbreakable: accounts.length <= 3
    }
  ];
}

function additionalDescriptionsContent(invoice: Invoice, labels: Record<string, string>, bilingual: boolean): Content[] {
  if (!invoice.additionalDescriptions?.length) return [];
  return [
    dataTable(
      [
        { key: "line", label: labels.line, width: 34 },
        { key: "key", label: labels.key, width: 130 },
        { key: "value", label: labels.value, width: "*" }
      ],
      invoice.additionalDescriptions.map((entry) => ({
        line: entry.lineNumber ?? "-",
        key: displayText(entry.translatedKey, entry.key, bilingual),
        value: displayText(entry.translatedValue, entry.value, bilingual)
      }))
    )
  ];
}

function annotationsContent(invoice: Invoice, labels: Record<string, string>): Content[] {
  const annotations = invoice.annotations;
  if (!annotations) return [];

  const lines: string[] = [];
  if (annotations.exemption?.enabled) lines.push(label(labels, "taxExemption", "Tax exemption"));
  if (annotations.exemption?.legalBasis) lines.push(`${label(labels, "legalBasis", "Legal basis")}: ${annotations.exemption.legalBasis}`);
  if (annotations.exemption?.directiveBasis) lines.push(`${label(labels, "directiveBasis", "Directive basis")}: ${annotations.exemption.directiveBasis}`);
  if (annotations.exemption?.otherBasis) lines.push(`${label(labels, "otherBasis", "Other basis")}: ${annotations.exemption.otherBasis}`);
  if (annotations.splitPayment) lines.push(label(labels, "splitPayment", "Split payment mechanism"));
  if (annotations.cashAccounting) lines.push(label(labels, "cashAccounting", "Cash accounting method"));
  if (annotations.reverseCharge) lines.push(label(labels, "reverseCharge", "Reverse charge"));
  if (annotations.selfBilling) lines.push(label(labels, "selfBilling", "Self-billing"));
  if (annotations.simplifiedTriangularProcedure) lines.push(label(labels, "simplifiedTriangularProcedure", "Simplified triangular procedure"));
  if (annotations.relatedParty) lines.push(label(labels, "relatedParty", "Related party transaction"));
  if (annotations.fiscalReceipt) lines.push(label(labels, "fiscalReceipt", "Invoice issued to fiscal receipt"));
  if (annotations.exciseTaxRefund) lines.push(label(labels, "exciseTaxRefund", "Excise tax refund"));
  if (annotations.marginProcedure) lines.push(`${label(labels, "marginProcedure", "Margin procedure")}: ${annotations.marginProcedure}`);
  if (annotations.newTransportMeans?.vatDocumentRequired) {
    lines.push(`${label(labels, "newTransportMeans", "New means of transport")}: ${annotations.newTransportMeans.vatDocumentRequired}`);
  }

  const content: Content[] = lines.length ? [{ ul: lines.map((line) => wrapPdfText(line)) }] : [];
  if (annotations.newTransportMeans?.lines?.length) {
    content.push(
      dataTable(
        [
          { key: "rowNumber", label: labels.line, width: 42 },
          { key: "firstUseDate", label: label(labels, "firstUseDate", "First use date"), width: 80 },
          { key: "description", label: labels.description, width: "*" },
          { key: "identifier", label: label(labels, "identifier", "Identifier"), width: "*" }
        ],
        annotations.newTransportMeans.lines
      )
    );
  }

  return content;
}

function transactionTermsContent(invoice: Invoice, labels: Record<string, string>): Content[] {
  const terms = invoice.transactionTerms;
  if (!terms) return [];

  const content: Content[] = [];
  if (terms.contracts?.length || terms.orders?.length) {
    content.push({
      columns: [
        terms.contracts?.length
          ? {
              width: "50%",
              stack: [
                { text: label(labels, "contracts", "Contracts"), style: "sectionHeader" },
                dataTable(
                  [
                    { key: "date", label: labels.issueDate, width: 70 },
                    { key: "number", label: labels.contractNumber, width: "*" }
                  ],
                  terms.contracts
                )
              ]
            }
          : { text: "", width: "50%" },
        terms.orders?.length
          ? {
              width: "50%",
              stack: [
                { text: labels.orders, style: "sectionHeader" },
                dataTable(
                  [
                    { key: "date", label: labels.issueDate, width: 70 },
                    { key: "number", label: labels.orderNumber, width: "*" }
                  ],
                  terms.orders
                )
              ]
            }
          : { text: "", width: "50%" }
      ],
      columnGap: 12
    });
  }

  const rows: [string, string][] = [
    [label(labels, "contractualCurrency", "Contractual currency"), terms.contractualCurrency ?? "-"],
    [label(labels, "contractualRate", "Contractual rate"), terms.contractualRate ?? "-"],
    [label(labels, "batchNumbers", "Batch numbers"), terms.batchNumbers?.join(", ") ?? "-"],
    [label(labels, "deliveryTerms", "Delivery terms"), terms.deliveryTerms ?? "-"],
    [label(labels, "intermediaryDelivery", "Intermediary delivery"), terms.intermediaryDelivery ? "Yes" : "-"]
  ].filter(([, value]) => value !== "-") as [string, string][];
  if (rows.length) content.push(keyValueCard(rows));

  if (terms.transports?.length) {
    content.push(
      { text: label(labels, "transport", "Transport"), style: "sectionHeader" },
      dataTable(
        [
          { key: "type", label: label(labels, "transportType", "Type"), width: 70 },
          { key: "otherTypeDescription", label: label(labels, "otherTypeDescription", "Other type"), width: "*" },
          { key: "orderNumber", label: labels.orderNumber, width: "*" },
          { key: "cargoDescription", label: label(labels, "cargoDescription", "Cargo"), width: "*" },
          { key: "packageUnit", label: label(labels, "packageUnit", "Package unit"), width: 60 },
          { key: "startDateTime", label: label(labels, "transportStart", "Start"), width: 70 },
          { key: "endDateTime", label: label(labels, "transportEnd", "End"), width: 70 },
          { key: "carrier", label: label(labels, "carrier", "Carrier"), width: "*" },
          { key: "vehicleNumber", label: label(labels, "vehicleNumber", "Vehicle number"), width: "*" },
          { key: "description", label: labels.description, width: "*" },
          { key: "shipFrom", label: label(labels, "shipFrom", "Ship from"), width: "*" },
          { key: "shipTo", label: label(labels, "shipTo", "Ship to"), width: "*" },
          { key: "shipThrough", label: label(labels, "shipThrough", "Ship through"), width: "*" }
        ],
        terms.transports.map((transport) => ({
          ...transport,
          shipThrough: transport.shipThrough?.join("\n")
        }))
      )
    );
  }

  return content;
}

function partiesContent(parties: Invoice["thirdParties"], labels: Record<string, string>): Content[] {
  if (!parties?.length) return [];
  return [
    {
      columns: parties.map((party) => ({
        width: "50%",
        stack: [partyCard(party.role ?? labels.thirdParties, party, labels)]
      })),
      columnGap: 12,
      unbreakable: parties.length <= 2
    }
  ];
}

function settlementsContent(invoice: Invoice, labels: Record<string, string>, bilingual: boolean): Content[] {
  if (!invoice.settlements) return [];
  const content: Content[] = [];
  const detailRows = [
    ...(invoice.settlements.charges ?? []).map((line, index) => ({
      type: `${labels.charges} ${index + 1}`,
      amount: moneyOrDash(line.amount, invoice.currency),
      reason: displayText(line.translatedReason, line.reason, bilingual)
    })),
    ...(invoice.settlements.deductions ?? []).map((line, index) => ({
      type: `${labels.deductions} ${index + 1}`,
      amount: moneyOrDash(line.amount, invoice.currency),
      reason: displayText(line.translatedReason, line.reason, bilingual)
    }))
  ];
  if (detailRows.length) {
    content.push(dataTable(
      [
        { key: "type", label: labels.description, width: 150 },
        { key: "amount", label: labels.amount, width: 74, alignment: "right", fontSize: 7 },
        { key: "reason", label: labels.reason, width: "*" }
      ],
      detailRows
    ));
  }
  const summaryRows: [string, string][] = [
    [label(labels, "totalCharges", "Total charges"), moneyOrDash(invoice.settlements.totalCharges, invoice.currency)],
    [label(labels, "totalDeductions", "Total deductions"), moneyOrDash(invoice.settlements.totalDeductions, invoice.currency)],
    [label(labels, "amountToPay", "Amount to pay"), moneyOrDash(invoice.settlements.amountToPay, invoice.currency)],
    [labels.amountToSettle, moneyOrDash(invoice.settlements.amountToSettle, invoice.currency)]
  ].filter(([, value]) => value !== "-") as [string, string][];
  if (summaryRows.length) content.push(keyValueCard(summaryRows));
  return content;
}

function ordersContent(invoice: Invoice, labels: Record<string, string>, bilingual: boolean): Content[] {
  if (!invoice.orders?.length) return [];
  const content: Content[] = [
    { text: labels.orders, style: "sectionHeader" },
    dataTable(
      [
        { key: "orderNumber", label: labels.orderNumber, width: "*" },
        { key: "contractNumber", label: labels.contractNumber, width: "*" },
        { key: "orderDate", label: label(labels, "orderDate", "Order date"), width: 70 },
        { key: "contractDate", label: label(labels, "contractDate", "Contract date"), width: 70 },
        { key: "totalValue", label: labels.totalValue, width: 74, alignment: "right", fontSize: 7 }
      ],
      invoice.orders.map((order) => ({
        orderNumber: order.orderNumber ?? "-",
        contractNumber: order.contractNumber,
        orderDate: order.orderDate,
        contractDate: order.contractDate,
        totalValue: order.totalValue === undefined ? undefined : moneyOrDash(order.totalValue, invoice.currency)
      }))
    )
  ];

  invoice.orders.forEach((order, index) => {
    if (!order.lines?.length) return;
    content.push(
      { text: `${labels.orders}: ${order.orderNumber ?? index + 1}`, style: "sectionHeader" },
      dataTable(
        [
          { key: "line", label: labels.line, width: 28 },
          { key: "uniqueRowNumber", label: label(labels, "uniqueRowNumber", "Unique row no."), width: 42 },
          { key: "index", label: labels.index, width: 34 },
          { key: "name", label: labels.description, width: "*" },
          { key: "unitPrice", label: labels.unitPrice, width: 58, alignment: "right", fontSize: 7 },
          { key: "quantity", label: labels.quantity, width: 58, alignment: "right", fontSize: 7 },
          { key: "unit", label: labels.unit, width: 36 },
          { key: "vatRate", label: labels.vatRate, width: 45 },
          { key: "ossVatRate", label: label(labels, "ossVatRate", "OSS VAT rate"), width: 45 },
          { key: "productMarker", label: label(labels, "productMarker", "Marker"), width: 42 },
          { key: "net", label: labels.netValue, width: 68, alignment: "right", fontSize: 7 },
          { key: "vat", label: labels.vatTotal, width: 58, alignment: "right", fontSize: 7 },
          { key: "gtin", label: "GTIN", width: 44 },
          { key: "pkwiu", label: "PKWiU", width: 44 },
          { key: "cn", label: "CN", width: 36 },
          { key: "pkob", label: "PKOB", width: 40 },
          { key: "exciseTaxAmount", label: label(labels, "exciseTaxAmount", "Excise"), width: 48, alignment: "right", fontSize: 7 },
          { key: "gtu", label: "GTU", width: 36 },
          { key: "procedure", label: label(labels, "procedure", "Procedure"), width: 70 },
          { key: "stateBefore", label: label(labels, "stateBefore", "Before"), width: 36 }
        ],
        order.lines.map((line) => ({
          line: line.lineNumber ?? "-",
          uniqueRowNumber: line.uniqueRowNumber,
          index: line.index,
          name: displayText(line.translatedName, line.name, bilingual),
          unitPrice: moneyOrDash(line.unitPrice, invoice.currency),
          quantity: line.quantity,
          unit: unitLabel(line.unit, line.translatedUnit, bilingual),
          vatRate: line.vatRate,
          ossVatRate: line.ossVatRate,
          productMarker: line.productMarker,
          net: moneyOrDash(line.netValue, invoice.currency),
          vat: moneyOrDash(line.vatValue, invoice.currency),
          gtin: line.gtin,
          pkwiu: line.pkwiu,
          cn: line.cn,
          pkob: line.pkob,
          exciseTaxAmount: moneyOrDash(line.exciseTaxAmount, invoice.currency),
          gtu: line.gtu,
          procedure: line.procedure,
          stateBefore: line.stateBefore
        }))
      )
    );
  });

  return content;
}

function footerContent(invoice: Invoice, labels: Record<string, string>, bilingual: boolean): Content[] {
  if (!invoice.footer) return [];
  const content: Content[] = [];
  if (invoice.footer.text) {
    content.push({ text: displayText(invoice.footer.translatedText, invoice.footer.text, bilingual) });
  }
  if (invoice.footer.registry) {
    content.push(
      registryTable(invoice.footer.registry, labels)
    );
  }
  return content;
}

function attachmentsContent(invoice: Invoice, labels: Record<string, string>): Content[] {
  const content: Content[] = [];
  if (invoice.warehouseDocuments?.length) {
    content.push(
      { text: label(labels, "warehouseDocuments", "Warehouse documents"), style: "sectionHeader" },
      dataTable(
        [
          { key: "number", label: label(labels, "documentNumber", "Document number"), width: "*" },
          { key: "date", label: labels.issueDate, width: 90 }
        ],
        invoice.warehouseDocuments
      )
    );
  }
  if (invoice.attachments?.length) {
    content.push(
      { text: label(labels, "attachments", "Attachments"), style: "sectionHeader" },
      dataTable(
        [
          { key: "fileName", label: label(labels, "fileName", "File name"), width: "*" },
          { key: "description", label: labels.description, width: "*" },
          { key: "hash", label: "Hash", width: "*" }
        ],
        invoice.attachments
      )
    );
  }
  return content;
}

function registryTable(registry: NonNullable<Invoice["footer"]>["registry"], labels: Record<string, string>): Content {
  return {
    table: {
      widths: ["*", "*", "*", "*"],
      body: [
        [
          { text: labels.registry, color: "#64748b", fontSize: 7, margin: [8, 8, 8, 2] },
          { text: labels.krs, color: "#64748b", fontSize: 7, margin: [8, 8, 8, 2] },
          { text: labels.regon, color: "#64748b", fontSize: 7, margin: [8, 8, 8, 2] },
          { text: labels.bdo, color: "#64748b", fontSize: 7, margin: [8, 8, 8, 2] }
        ],
        [
          { text: wrapPdfText(registry?.fullName ?? "-"), bold: true, color: "#020617", margin: [8, 0, 8, 8] },
          { text: registry?.krs ?? "-", bold: true, color: "#020617", margin: [8, 0, 8, 8] },
          { text: registry?.regon ?? "-", bold: true, color: "#020617", margin: [8, 0, 8, 8] },
          { text: registry?.bdo ?? "-", bold: true, color: "#020617", margin: [8, 0, 8, 8] }
        ]
      ]
    },
    layout: cardLayout(),
    unbreakable: true
  };
}

function verificationContent(invoice: Invoice, labels: Record<string, string>, verificationQr?: string): Content[] {
  if (!invoice.verification?.qrLink || !verificationQr) return [];
  return [
    {
      columns: [
        {
          image: verificationQr,
          width: 72,
          margin: [0, 0, 12, 0]
        },
        {
          width: "*",
          stack: [
            keyValueCard([
              [labels.ksefNumber, invoice.verification.ksefNumber ?? "-"],
              [labels.verificationLink, invoice.verification.qrLink]
            ]),
            {
              text: "QR KSeF",
              style: "muted"
            }
          ]
        }
      ],
      columnGap: 10
    }
  ];
}

function dataTable(headers: DataTableHeader[], rows: Row[]): ContentTable {
  const activeHeaders = headers.filter((header) => rows.some((row) => row[header.key] !== undefined && row[header.key] !== ""));
  return {
    table: {
      headerRows: 1,
      keepWithHeaderRows: 1,
      widths: activeHeaders.map((header) => header.width),
      body: [
        activeHeaders.map((header) => ({
          text: wrapPdfText(header.label),
          style: "tableHeader",
          alignment: header.alignment,
          fontSize: header.fontSize
        })),
        ...rows.map((row) => activeHeaders.map((header) => cell(row[header.key], header)))
      ] as TableCell[][]
    },
    layout: tableLayout()
  };
}

function keyValueTable(rows: [string, string][]): ContentTable {
  return {
    table: {
      dontBreakRows: true,
      widths: ["auto", "*"],
      body: keyValueRows(rows)
    },
    layout: "noBorders",
    margin: [0, 0, 0, 4],
    unbreakable: rows.length <= 8
  };
}

function keyValueCard(rows: [string, string][]): Content {
  return {
    table: {
      widths: ["*"],
      body: [
        [keyValueCardCell(rows)]
      ]
    },
    layout: cardLayout(),
    unbreakable: rows.length <= 8
  };
}

function keyValueCardCell(rows: [string, string][]): TableCell {
  return {
    stack: [keyValueTable(rows)],
    margin: [10, 10, 10, 8]
  };
}

function keyValueRows(rows: [string, string][], valueAlignment: "left" | "right" = "left"): TableCell[][] {
  return rows.map(([label, value]) => [
    { text: `${label}: `, style: "label" },
    { text: wrapPdfText(value || "-"), preserveLeadingSpaces: true, alignment: valueAlignment }
  ]);
}

function cell(value: string | number | undefined, header?: DataTableHeader): TableCell {
  return {
    text: value === undefined || value === "" ? "-" : wrapPdfText(String(value)),
    alignment: header?.alignment,
    fontSize: header?.fontSize,
    margin: [2, 2, 2, 2]
  };
}

function line(): Content {
  return {
    table: {
      widths: ["*"],
      body: [[{ text: " ", fontSize: 1 }]]
    },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 1 : 0),
      vLineWidth: () => 0,
      hLineColor: () => "#cbd5e1",
      paddingTop: () => 0,
      paddingBottom: () => 0
    }
  };
}

function tableLayout() {
  return {
    hLineWidth: () => 0.6,
    vLineWidth: () => 0.6,
    hLineColor: () => "#d7dee8",
    vLineColor: () => "#d7dee8",
    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => 3,
    paddingBottom: () => 3
  };
}

function cardLayout() {
  return {
    hLineWidth: () => 0.8,
    vLineWidth: () => 0.8,
    hLineColor: () => "#d7dee8",
    vLineColor: () => "#d7dee8",
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0
  };
}

function spacedCardGridLayout() {
  return {
    hLineWidth: () => 0,
    vLineWidth: () => 0,
    paddingLeft: () => 0,
    paddingRight: () => 12,
    paddingTop: () => 0,
    paddingBottom: () => 12
  };
}

function avoidOrphanedSectionHeader(currentNode: PdfNode, nodeQueries: NodeQueries) {
  if (currentNode.headlineLevel !== 1) return false;
  return nodeQueries.getFollowingNodesOnPage().length === 0;
}

function displayText(translated: string | undefined, original: string | undefined, bilingual: boolean) {
  if (!translated && !original) return "-";
  if (!bilingual) return translated || original || "-";
  if (!translated || translated === original) return original ?? translated ?? "-";
  return `${translated}\n${original}`;
}

function wrapPdfText(value: string) {
  return value.replace(/\S{24,}/g, (token) =>
    token
      .replace(/([/@._-])/g, "$1 ")
      .replace(/([A-Z0-9]{12})(?=[A-Z0-9])/g, "$1 ")
  );
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

function unitLabel(original: string | undefined, translated: string | undefined, bilingual: boolean) {
  if (!original) return "";
  if (!bilingual) return translated || original;
  if (!translated || translated === original) return original;
  return `${translated} / ${original}`;
}

function moneyOrDash(value: number | undefined, currency: string) {
  return value === undefined ? "-" : formatMoney(value, currency);
}

function label(labels: Record<string, string>, key: string, fallback: string) {
  return labels[key] || fallback;
}

function serviceDateLabel(kind: InvoiceDetails["serviceDateKind"], labels: Record<string, string>) {
  return kind === "paymentReceived"
    ? label(labels, "paymentReceivedDate", "Payment receipt date")
    : label(labels, "deliveryOrServiceDate", "Delivery/service completion date");
}

function servicePeriodValue(details: InvoiceDetails) {
  if (details.serviceDateFrom && details.serviceDateTo) {
    return `${details.serviceDateFrom} - ${details.serviceDateTo}`;
  }
  if (details.serviceDateFrom) return `${details.serviceDateFrom}`;
  if (details.serviceDateTo) return `${details.serviceDateTo}`;
  return undefined;
}

function paymentStatusLabel(status: NonNullable<Invoice["payment"]>["status"], labels: Record<string, string>) {
  if (status === "paid") return label(labels, "paidStatus", "Paid");
  if (status === "paidInPart") return label(labels, "paidInPart", "Paid in part");
  if (status === "paidAllInParts") return label(labels, "paidAllInParts", "Paid in full in parts");
  return label(labels, "noPayment", "No payment");
}
