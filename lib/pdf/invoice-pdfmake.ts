import pdfMake from "pdfmake";
import QRCode from "qrcode";
import type {
  Content,
  ContentTable,
  StyleDictionary,
  TDocumentDefinitions,
  TableCell
} from "pdfmake/interfaces";
import type { BankAccount, Invoice, LanguageCode } from "@/types/invoice";
import { getBilingualLabels, getLabels } from "@/lib/translation/dictionaries";
import { formatMoney } from "@/lib/invoice/format";

type Row = Record<string, string | number | undefined>;
type PdfMakeWithPolicies = typeof pdfMake & {
  setLocalAccessPolicy?: (policy: (path: string) => boolean) => void;
  setUrlAccessPolicy?: (policy: (url: string) => boolean) => void;
};

const fontDirectory = "node_modules/pdfmake/fonts/Roboto";

const fonts = {
  Roboto: {
    normal: `${fontDirectory}/Roboto-Regular.ttf`,
    bold: `${fontDirectory}/Roboto-Medium.ttf`,
    italics: `${fontDirectory}/Roboto-Italic.ttf`,
    bolditalics: `${fontDirectory}/Roboto-MediumItalic.ttf`
  }
};

const styles: StyleDictionary = {
  title: { fontSize: 18, bold: true, color: "#1f2937" },
  subtitle: { fontSize: 8, color: "#64748b" },
  sectionHeader: { fontSize: 10, bold: true, color: "#1f2937", margin: [0, 8, 0, 6] },
  label: { bold: true, color: "#343a40" },
  muted: { color: "#64748b", fontSize: 7 },
  tableHeader: { bold: true, fillColor: "#f1f5f9", color: "#343a40" },
  total: { bold: true, fontSize: 10 }
};

export async function renderInvoicePdfMake(invoice: Invoice, language: LanguageCode, bilingual = true) {
  const pdfMakeServer = pdfMake as PdfMakeWithPolicies;
  pdfMakeServer.setLocalAccessPolicy?.((path) => path.replaceAll("\\", "/").includes(fontDirectory));
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
    header(invoice, labels, bilingual),
    section(labels.seller + " / " + labels.buyer, [
      twoColumns(partyRows(invoice.seller, labels), partyRows(invoice.buyer, labels))
    ]),
    section(labels.description, [itemsTable(invoice, labels, bilingual)]),
    section(labels.taxSummary, [taxSummaryTable(invoice, labels)]),
    section(labels.payment, paymentContent(invoice, labels)),
    ...optionalSection(labels.additionalInformation, additionalDescriptionsContent(invoice, labels, bilingual)),
    ...optionalSection(labels.thirdParties, partiesContent(invoice.thirdParties ?? [], labels)),
    ...optionalSection(labels.authorizedParty, invoice.authorizedParty ? partiesContent([invoice.authorizedParty], labels) : []),
    ...optionalSection(labels.settlements, settlementsContent(invoice, labels, bilingual)),
    ...optionalSection(labels.transactionTerms ?? labels.orders, ordersContent(invoice, labels, bilingual)),
    ...optionalSection(labels.footer, footerContent(invoice, labels, bilingual)),
    ...optionalSection(labels.verification, verificationContent(invoice, labels, verificationQr)),
    {
      text: labels.translatedRepresentation,
      style: "muted",
      margin: [0, 16, 0, 0]
    }
  ];

  return {
    pageSize: "A4",
    pageMargins: [32, 32, 32, 44],
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
      margin: [32, 0, 32, 0]
    }),
    styles,
    defaultStyle: {
      font: "Roboto",
      fontSize: 8,
      lineHeight: 1.15
    }
  };
}

function header(invoice: Invoice, labels: Record<string, string>, bilingual: boolean): Content {
  return {
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
          widths: ["auto", "*"],
          body: keyValueRows([
            [labels.invoiceNumber, invoice.invoiceNumber],
            ...(invoice.invoiceType || invoice.invoiceTypeLabel ? [[labels.invoiceType, invoiceTypeLabel(invoice, labels, bilingual)]] as [string, string][] : []),
            [labels.issueDate, invoice.issueDate],
            [labels.saleDate, invoice.saleDate ?? "-"],
            [labels.currency, invoice.currency]
          ])
        },
        layout: "noBorders",
        width: 230
      }
    ],
    margin: [0, 0, 0, 10]
  };
}

function section(title: string, stack: Content[]): Content {
  return {
    stack: [line(), { text: title, style: "sectionHeader" }, ...stack],
    margin: [0, 4, 0, 8]
  };
}

function optionalSection(title: string, stack: Content[]): Content[] {
  return stack.length ? [section(title, stack)] : [];
}

function twoColumns(leftRows: [string, string][], rightRows: [string, string][]): Content {
  return {
    columns: [
      keyValueTable(leftRows),
      keyValueTable(rightRows)
    ],
    columnGap: 20,
    unbreakable: true
  };
}

function partyRows(party: Invoice["seller"], labels: Record<string, string>): [string, string][] {
  return [
    [labels.description, party.name],
    [labels.vatId, party.vatId ?? "-"],
    [labels.address, party.address ?? "-"],
    [labels.customerNumber ?? "Customer number", party.customerNumber ?? "-"],
    [labels.role ?? "Role", party.role ?? "-"]
  ].filter(([, value]) => value !== "-") as [string, string][];
}

function itemsTable(invoice: Invoice, labels: Record<string, string>, bilingual: boolean): Content {
  const showIndex = invoice.items.some((item) => item.index);
  const headers = [
    ...(showIndex ? [{ key: "index", label: labels.index, width: "auto" as const }] : []),
    { key: "name", label: labels.description, width: "*" as const },
    { key: "quantity", label: labels.quantity, width: "auto" as const },
    { key: "unitPrice", label: labels.unitPrice, width: "auto" as const },
    { key: "vatRate", label: labels.vatRate, width: "auto" as const },
    { key: "netValue", label: labels.netValue, width: "auto" as const },
    { key: "grossValue", label: labels.grossValue, width: "auto" as const }
  ];
  const rows = invoice.items.map((item) => ({
    index: item.index,
    name: displayText(item.translatedName, item.name, bilingual),
    quantity: `${item.quantity} ${unitLabel(item.unit, item.translatedUnit, bilingual)}`,
    unitPrice: formatMoney(item.unitPrice, invoice.currency),
    vatRate: item.vatRate,
    netValue: formatMoney(item.netValue, invoice.currency),
    grossValue: formatMoney(item.grossValue, invoice.currency)
  }));
  return dataTable(headers, rows);
}

function taxSummaryTable(invoice: Invoice, labels: Record<string, string>): Content {
  if (!invoice.taxBreakdown?.length) return { text: "-" };
  return dataTable(
    [
      { key: "label", label: labels.description, width: "*" },
      { key: "net", label: labels.netValue, width: "auto" },
      { key: "vat", label: labels.vatTotal, width: "auto" },
      { key: "vatInPln", label: "VAT PLN", width: "auto" }
    ],
    invoice.taxBreakdown.map((line) => ({
      label: line.label,
      net: moneyOrDash(line.net, invoice.currency),
      vat: moneyOrDash(line.vat, invoice.currency),
      vatInPln: moneyOrDash(line.vatInPln, "PLN")
    }))
  );
}

function paymentContent(invoice: Invoice, labels: Record<string, string>): Content[] {
  const payment = invoice.payment;
  if (!payment) return [{ text: "-" }];
  const stack: Content[] = [
    keyValueTable([
      [labels.dueDate, payment.dueDate ?? "-"],
      [labels.method, payment.methodLabel ?? payment.method ?? "-"],
      [labels.paid, payment.isPaid ?? "-"],
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
          { key: "dueDate", label: labels.dueDate, width: "auto" },
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
          { key: "date", label: labels.paidDate, width: "auto" },
          { key: "amount", label: labels.amount, width: "auto" },
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

  stack.push(...bankAccountContent(labels.bankAccounts, payment.bankAccounts ?? [], labels));
  stack.push(...bankAccountContent(labels.factorBankAccounts, payment.factorBankAccounts ?? [], labels));
  return stack;
}

function bankAccountContent(title: string, accounts: BankAccount[], labels: Record<string, string>): Content[] {
  if (!accounts.length) return [];
  return [
    { text: title, style: "sectionHeader" },
    {
      columns: accounts.map((account) => ({
        width: `${Math.floor(100 / Math.min(accounts.length, 2))}%`,
        stack: [
          keyValueTable([
            [labels.bankName, account.bankName ?? "-"],
            [labels.accountNumber, account.accountNumber],
            [labels.swift, account.swift ?? "-"],
            [labels.accountDescription, account.description ?? "-"]
          ])
        ]
      })),
      columnGap: 12
    }
  ];
}

function additionalDescriptionsContent(invoice: Invoice, labels: Record<string, string>, bilingual: boolean): Content[] {
  if (!invoice.additionalDescriptions?.length) return [];
  return [
    dataTable(
      [
        { key: "line", label: labels.line, width: "auto" },
        { key: "key", label: labels.key, width: "auto" },
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

function partiesContent(parties: Invoice["thirdParties"], labels: Record<string, string>): Content[] {
  if (!parties?.length) return [];
  return [
    {
      columns: parties.map((party) => ({
        width: "50%",
        stack: [keyValueTable(partyRows(party, labels))]
      })),
      columnGap: 12
    }
  ];
}

function settlementsContent(invoice: Invoice, labels: Record<string, string>, bilingual: boolean): Content[] {
  if (!invoice.settlements) return [];
  const rows = [
    ...(invoice.settlements.charges ?? []).map((line, index) => ({
      type: `${labels.charges} ${index + 1}`,
      amount: moneyOrDash(line.amount, invoice.currency),
      reason: displayText(line.translatedReason, line.reason, bilingual)
    })),
    ...(invoice.settlements.deductions ?? []).map((line, index) => ({
      type: `${labels.deductions} ${index + 1}`,
      amount: moneyOrDash(line.amount, invoice.currency),
      reason: displayText(line.translatedReason, line.reason, bilingual)
    })),
    {
      type: labels.amountToSettle,
      amount: moneyOrDash(invoice.settlements.amountToSettle, invoice.currency),
      reason: ""
    }
  ];
  return [
    dataTable(
      [
        { key: "type", label: labels.description, width: "*" },
        { key: "amount", label: labels.amount, width: "auto" },
        { key: "reason", label: labels.reason, width: "*" }
      ],
      rows
    )
  ];
}

function ordersContent(invoice: Invoice, labels: Record<string, string>, bilingual: boolean): Content[] {
  if (!invoice.orders?.length) return [];
  const content: Content[] = [
    { text: labels.orders, style: "sectionHeader" },
    dataTable(
      [
        { key: "orderNumber", label: labels.orderNumber, width: "*" },
        { key: "contractNumber", label: labels.contractNumber, width: "*" },
        { key: "totalValue", label: labels.totalValue, width: "auto" }
      ],
      invoice.orders.map((order) => ({
        orderNumber: order.orderNumber ?? "-",
        contractNumber: order.contractNumber,
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
          { key: "line", label: labels.line, width: "auto" },
          { key: "index", label: labels.index, width: "auto" },
          { key: "name", label: labels.description, width: "*" },
          { key: "quantity", label: labels.quantity, width: "auto" },
          { key: "net", label: labels.netValue, width: "auto" }
        ],
        order.lines.map((line) => ({
          line: line.lineNumber ?? "-",
          index: line.index,
          name: displayText(line.translatedName, line.name, bilingual),
          quantity: `${line.quantity ?? "-"} ${unitLabel(line.unit, line.translatedUnit, bilingual)}`,
          net: moneyOrDash(line.netValue, invoice.currency)
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
      keyValueTable([
        [labels.registry, invoice.footer.registry.fullName ?? "-"],
        [labels.krs, invoice.footer.registry.krs ?? "-"],
        [labels.regon, invoice.footer.registry.regon ?? "-"],
        [labels.bdo, invoice.footer.registry.bdo ?? "-"]
      ])
    );
  }
  return content;
}

function verificationContent(invoice: Invoice, labels: Record<string, string>, verificationQr?: string): Content[] {
  if (!invoice.verification?.ksefNumber && !invoice.verification?.qrLink) return [];
  return [
    {
      columns: [
        verificationQr
          ? {
              image: verificationQr,
              width: 72,
              margin: [0, 0, 12, 0]
            }
          : { text: "", width: 0 },
        {
          width: "*",
          stack: [
            keyValueTable([
              [labels.ksefNumber, invoice.verification.ksefNumber ?? "-"],
              [labels.verificationLink, invoice.verification.qrLink ?? "-"]
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

function dataTable(headers: { key: string; label: string; width: string }[], rows: Row[]): ContentTable {
  const activeHeaders = headers.filter((header) => rows.some((row) => row[header.key] !== undefined && row[header.key] !== ""));
  return {
    table: {
      headerRows: 1,
      keepWithHeaderRows: 1,
      widths: activeHeaders.map((header) => header.width),
      body: [
        activeHeaders.map((header) => ({ text: header.label, style: "tableHeader" })),
        ...rows.map((row) => activeHeaders.map((header) => cell(row[header.key])))
      ] as TableCell[][]
    },
    layout: tableLayout()
  };
}

function keyValueTable(rows: [string, string][]): ContentTable {
  return {
    table: {
      widths: ["auto", "*"],
      body: keyValueRows(rows)
    },
    layout: "noBorders",
    margin: [0, 0, 0, 4]
  };
}

function keyValueRows(rows: [string, string][]): TableCell[][] {
  return rows.map(([label, value]) => [
    { text: `${label}: `, style: "label" },
    { text: value || "-", preserveLeadingSpaces: true }
  ]);
}

function cell(value: string | number | undefined): TableCell {
  return {
    text: value === undefined || value === "" ? "-" : String(value),
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

function displayText(translated: string | undefined, original: string | undefined, bilingual: boolean) {
  if (!translated && !original) return "-";
  if (!bilingual) return translated || original || "-";
  if (!translated || translated === original) return original ?? translated ?? "-";
  return `${translated}\n${original}`;
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
