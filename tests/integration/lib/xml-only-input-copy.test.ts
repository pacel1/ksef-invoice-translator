import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { landingCopy } from "@/lib/landing/copy";
import { marketingCopy } from "@/lib/marketing/copy";
import { copy as workspaceCopy } from "@/lib/workspace/copy";

/**
 * The product translates invoices from KSeF FA(3) XML only. PDF appears in
 * copy exclusively as the OUTPUT format ("Pobierz PDF", "MF-compliant PDF").
 * These patterns catch every phrasing we have used to advertise PDF as an
 * INPUT format, so it cannot creep back into user-facing copy.
 */
const BANNED_INPUT_PDF_PATTERNS: ReadonlyArray<RegExp> = [
  /XML\s+(lub|albo|or|i|and)\s+(a\s+)?(rendered\s+)?(KSeF\s+)?PDF/i,
  /XML\/PDF/i,
  /PDF\s+(z\s+|faktury\s+)?KSeF/i,
  /KSeF\s+PDF/i,
  /Analizuję PDF/i,
  /Parsing KSeF PDF/i,
  /PDF\s+upload/i
];

function expectNoInputPdfClaims(label: string, haystack: string) {
  for (const pattern of BANNED_INPUT_PDF_PATTERNS) {
    const match = haystack.match(pattern);
    expect(
      match,
      `${label} still advertises PDF as an input format: "${match?.[0]}" (pattern ${pattern})`
    ).toBeNull();
  }
}

describe("XML-only input copy", () => {
  it("landing copy does not advertise PDF as an input format", () => {
    expectNoInputPdfClaims("landingCopy", JSON.stringify(landingCopy));
  });

  it("marketing copy does not advertise PDF as an input format", () => {
    expectNoInputPdfClaims("marketingCopy", JSON.stringify(marketingCopy));
  });

  it("workspace copy does not advertise PDF as an input format", () => {
    expectNoInputPdfClaims("workspaceCopy", JSON.stringify(workspaceCopy));
  });

  it("root layout metadata does not advertise PDF as an input format", () => {
    const source = readFileSync(
      join(process.cwd(), "app", "layout.tsx"),
      "utf8"
    );
    expectNoInputPdfClaims("app/layout.tsx metadata", source);
  });
});
