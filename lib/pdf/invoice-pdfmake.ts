import pdfMake from "pdfmake";
import QRCode from "qrcode";
import type {
  Content,
  ContentTable,
  Node as PdfNode,
  NodeQueries,
  StyleDictionary,
  TDocumentDefinitions,
  TableCell
} from "pdfmake/interfaces";
import type { BankAccount, Invoice, LanguageCode } from "@/types/invoice";
import { getBilingualLabels, getLabels } from "@/lib/translation/dictionaries";
import { formatMoney } from "@/lib/invoice/format";

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
    partyCardsRow(labels, invoice),
    section(labels.description, [itemsTable(invoice, labels, bilingual)]),
    paymentAndTotals(invoice, labels),
    section(labels.taxSummary, [taxSummaryTable(invoice, labels)]),
    ...bankAccountsSections(invoice, labels),
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

function paymentAndTotals(invoice: Invoice, labels: Record<string, string>): Content {
  return {
    columns: [
      {
        width: "*",
        stack: sectionStack(labels.payment, paymentContent(invoice, labels))
      },
      {
        width: 190,
        stack: [
          {
            table: {
              widths: ["*", "auto"],
              body: [
                totalRow(labels.netTotal, formatMoney(invoice.totals.net, invoice.currency)),
                totalRow(labels.vatTotal, formatMoney(invoice.totals.vat, invoice.currency)),
                totalRow(labels.grossTotal, formatMoney(invoice.totals.gross, invoice.currency), true)
              ]
            },
            layout: totalLayout()
          }
        ],
        margin: [16, 18, 0, 0]
      }
    ],
    columnGap: 12,
    margin: [0, 2, 0, 10]
  };
}

function totalRow(label: string, value: string, strong = false): TableCell[] {
  return [
    { text: label, color: "#64748b", fontSize: strong ? 9 : 8, margin: [0, 4, 8, 4] },
    { text: value, bold: true, color: "#020617", fontSize: strong ? 11 : 8, alignment: "right", margin: [8, 4, 0, 4] }
  ];
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

function itemsTable(invoice: Invoice, labels: Record<string, string>, bilingual: boolean): Content {
  const showIndex = invoice.items.some((item) => item.index);
  const headers: DataTableHeader[] = [
    ...(showIndex ? [{ key: "index", label: labels.index, width: 24, fontSize: 7 }] : []),
    { key: "name", label: labels.description, width: "*" },
    { key: "quantity", label: labels.quantity, width: 48, alignment: "right", fontSize: 7 },
    { key: "unitPrice", label: labels.unitPrice, width: 56, alignment: "right", fontSize: 7 },
    { key: "vatRate", label: labels.vatRate, width: 34, alignment: "right", fontSize: 7 },
    { key: "netValue", label: labels.netValue, width: 56, alignment: "right", fontSize: 7 },
    { key: "grossValue", label: labels.grossValue, width: 58, alignment: "right", fontSize: 7 }
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
      { key: "net", label: labels.netValue, width: 68, alignment: "right", fontSize: 7 },
      { key: "vat", label: labels.vatTotal, width: 68, alignment: "right", fontSize: 7 },
      { key: "vatInPln", label: "VAT PLN", width: 68, alignment: "right", fontSize: 7 }
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
        { key: "type", label: labels.description, width: 150 },
        { key: "amount", label: labels.amount, width: 74, alignment: "right", fontSize: 7 },
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
        { key: "totalValue", label: labels.totalValue, width: 74, alignment: "right", fontSize: 7 }
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
          { key: "line", label: labels.line, width: 28 },
          { key: "index", label: labels.index, width: 34 },
          { key: "name", label: labels.description, width: "*" },
          { key: "quantity", label: labels.quantity, width: 58, alignment: "right", fontSize: 7 },
          { key: "net", label: labels.netValue, width: 68, alignment: "right", fontSize: 7 }
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
      registryTable(invoice.footer.registry, labels)
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
            keyValueCard([
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

function totalLayout() {
  return {
    hLineWidth: (i: number) => (i === 0 ? 1.2 : i === 3 ? 0 : 0),
    vLineWidth: () => 0,
    hLineColor: () => "#0e7490",
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
