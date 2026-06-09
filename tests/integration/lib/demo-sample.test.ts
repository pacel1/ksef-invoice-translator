import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseKsefXml } from "@/lib/xml/parser";
import { DEMO_LANGS, DEMO_DEFAULT_LANG, DEMO_SAMPLE_INVOICE, buildDemoInvoice } from "@/lib/landing/demo-sample";

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

describe("demo-sample baked data", () => {
  it("exposes six languages with EN as the default", () => {
    expect(DEMO_LANGS.map((l) => l.code)).toEqual(["en", "de", "fr", "es", "it", "cs"]);
    expect(DEMO_DEFAULT_LANG).toBe("en");
    for (const lang of DEMO_LANGS) {
      expect(lang.label).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("keeps every preserved field byte-identical across all languages", () => {
    const base = DEMO_SAMPLE_INVOICE;
    for (const { code } of DEMO_LANGS) {
      const inv = buildDemoInvoice(code);
      expect(inv.invoiceNumber).toBe(base.invoiceNumber);
      expect(inv.seller.vatId).toBe(base.seller.vatId);
      expect(inv.buyer.vatId).toBe(base.buyer.vatId);
      expect(inv.issueDate).toBe(base.issueDate);
      expect(inv.saleDate).toBe(base.saleDate);
      expect(inv.totals).toEqual(base.totals);
      expect(inv.verification?.ksefNumber).toBe(base.verification?.ksefNumber);
      expect(inv.payment?.bankAccounts?.[0]?.accountNumber).toBe(
        base.payment?.bankAccounts?.[0]?.accountNumber
      );
      expect(inv.items.map((i) => i.netValue)).toEqual(base.items.map((i) => i.netValue));
    }
  });

  it("translates the free text per language without mutating the base", () => {
    const en = buildDemoInvoice("en");
    const de = buildDemoInvoice("de");
    expect(en.items[1].translatedName).toBe("Oak chair „Helena”");
    expect(de.items[1].translatedName).toBe("Eichenstuhl „Helena”");
    expect(en.footer?.translatedText).toBe("Share capital PLN 200,000");
    expect(DEMO_SAMPLE_INVOICE.items[1].translatedName).toBeUndefined();
  });
});
