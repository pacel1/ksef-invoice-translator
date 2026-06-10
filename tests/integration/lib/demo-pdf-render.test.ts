import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderOfficialFa3Pdf } from "@/lib/mf-fa3/official-renderer";
import { buildDemoInvoice } from "@/lib/landing/demo-sample";

describe("demo PDF renders statelessly", () => {
  it("produces a non-empty PDF for the English demo invoice", async () => {
    const sourceXml = readFileSync(join(process.cwd(), "public/sample-data/demo-fa3-export.xml"), "utf8");
    const pdf = await renderOfficialFa3Pdf({
      sourceXml,
      invoice: buildDemoInvoice("en"),
      language: "en",
      bilingual: false,
      translated: true
    });
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);
});
