import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { applyTranslationNoticesToPdf } from "@/lib/pdf/translation-notice-pdf";
import {
  createTranslationNotices,
  getTranslationNoticeConfig,
  TRANSLATION_NOTICE_BY_LANGUAGE
} from "@/lib/pdf/translation-notices";

describe("translation notices", () => {
  it("defines notices for every supported translation language", () => {
    expect(Object.keys(TRANSLATION_NOTICE_BY_LANGUAGE)).toHaveLength(22);
  });

  it("replaces every placeholder in every language", () => {
    for (const language of Object.keys(TRANSLATION_NOTICE_BY_LANGUAGE)) {
      const notices = createTranslationNotices(language, {
        reviewedBy: "ACME Sp. z o.o.",
        generatedAt: "2026-05-18 14:35"
      });

      expect(notices.translationNotice).not.toMatch(/\{reviewedBy\}|\{generatedAt\}|\{visualisationSystem\}/);
      expect(notices.footerNotice).not.toMatch(/\{reviewedBy\}|\{generatedAt\}|\{visualisationSystem\}/);
      expect(notices.footerNotice).toContain("ACME Sp. z o.o.");
      expect(notices.translationNotice).toContain("Informacja o tłumaczeniu");
      expect(notices.translationNotice).toContain("Zweryfikowane i zatwierdzone przez: ACME Sp. z o.o.");
    }
  });

  it("falls back to English for unsupported languages", () => {
    const notices = createTranslationNotices("unsupported", {
      reviewedBy: "ACME Sp. z o.o.",
      generatedAt: "2026-05-18 14:35"
    });

    expect(getTranslationNoticeConfig("unsupported")).toEqual(getTranslationNoticeConfig("en"));
    expect(notices.translationNotice).toContain("Translation notice");
    expect(notices.translationNotice).toContain("Reviewed and approved by: ACME Sp. z o.o.");
    expect(notices.translationNotice).toContain("Generated on: 2026-05-18 14:35");
    expect(notices.translationNotice).toContain("Visualisation system: tlumaczksef.pl");
    expect(notices.translationNotice).toContain("Język: angielski");
    expect(notices.footerNotice).toContain("Reviewed and approved by: ACME Sp. z o.o.");
  });

  it("uses the translated language name in the Polish notice section", () => {
    const englishNotices = createTranslationNotices("en", {
      reviewedBy: "ACME Sp. z o.o.",
      generatedAt: "2026-05-18 14:35"
    });
    const germanNotices = createTranslationNotices("de", {
      reviewedBy: "ACME Sp. z o.o.",
      generatedAt: "2026-05-18 14:35"
    });

    expect(englishNotices.translationNotice).toContain("Język: angielski");
    expect(germanNotices.translationNotice).toContain("Język: niemiecki");
    expect(englishNotices.translationNotice).not.toContain("Język: polski");
  });

  it("adds final notice pages to generated PDFs", async () => {
    const sourceDocument = await PDFDocument.create();
    sourceDocument.addPage();
    const sourceBytes = await sourceDocument.save();

    const result = await applyTranslationNoticesToPdf(Buffer.from(sourceBytes), "en", {
      reviewedBy: "Account user",
      generatedAt: "2026-05-18 14:35"
    });

    const resultDocument = await PDFDocument.load(result);
    expect(resultDocument.getPageCount()).toBe(2);
  });
});
