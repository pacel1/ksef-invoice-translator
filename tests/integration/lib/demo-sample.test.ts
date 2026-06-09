import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseKsefXml } from "@/lib/xml/parser";

const xml = readFileSync(
  join(process.cwd(), "public/sample-data/demo-fa3-export.xml"),
  "utf8"
);

describe("demo-fa3-export.xml", () => {
  it("parses cleanly as a KSeF FA(3) invoice", () => {
    const result = parseKsefXml(xml);
    expect(result.ok).toBe(true);
  });

  it("carries the expected export-invoice values", () => {
    const result = parseKsefXml(xml);
    if (!result.ok) throw new Error(result.error);
    const inv = result.invoice;
    expect(inv.invoiceNumber).toBe("FV 2026/05/0142");
    expect(inv.currency).toBe("EUR");
    expect(inv.seller.vatId).toBe("7811924552");
    expect(inv.buyer.vatId).toBe("DE811569244");
    expect(inv.items).toHaveLength(3);
    expect(inv.totals.net).toBe(10200);
    expect(inv.totals.vat).toBe(0);
    expect(inv.totals.gross).toBe(10200);
  });
});
