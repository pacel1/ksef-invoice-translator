import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, rgb } from "pdf-lib";
import { createTranslationNotices, type TranslationNoticePlaceholderData } from "@/lib/pdf/translation-notices";

const fontDirectory = "node_modules/pdfmake/fonts/Roboto";
const regularFontPath = path.join(process.cwd(), fontDirectory, "Roboto-Regular.ttf");
const mediumFontPath = path.join(process.cwd(), fontDirectory, "Roboto-Medium.ttf");
const A4 = { width: 595.28, height: 841.89 };
const marginX = 46;
const contentTop = 70;
const footerY = 18;
const metadataPaddingX = 8;
const metadataPaddingY = 8;
const afterMetadataGap = 13;
const textColor = rgb(0.12, 0.16, 0.22);
const mutedColor = rgb(0.39, 0.46, 0.55);
const accentColor = rgb(0.06, 0.46, 0.56);
const ruleColor = rgb(0.82, 0.87, 0.92);

export async function applyTranslationNoticesToPdf(
  pdf: Buffer | Uint8Array,
  language: string,
  data: TranslationNoticePlaceholderData
): Promise<Buffer> {
  const notices = createTranslationNotices(language, data);
  const document = await PDFDocument.load(pdf);
  document.registerFontkit(fontkit);

  const regularFont = await document.embedFont(fs.readFileSync(regularFontPath), { subset: true });
  const mediumFont = await document.embedFont(fs.readFileSync(mediumFontPath), { subset: true });

  drawTranslationNoticePages(document, regularFont, mediumFont, notices.translationNotice);
  drawFooterNoticeOnEveryPage(document, regularFont, notices.footerNotice);

  return Buffer.from(await document.save());
}

function drawFooterNoticeOnEveryPage(document: PDFDocument, font: PDFFont, notice: string) {
  for (const page of document.getPages()) {
    const { width } = page.getSize();
    const lines = wrapText(notice, font, 6.5, width - marginX * 2).slice(0, 3);
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: marginX,
        y: footerY + (lines.length - index - 1) * 7.5,
        size: 6.5,
        font,
        color: mutedColor
      });
    });
  }
}

function drawTranslationNoticePages(document: PDFDocument, regularFont: PDFFont, mediumFont: PDFFont, notice: string) {
  const paragraphs = notice.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (!paragraphs.length) return;

  let page = addNoticePage(document, mediumFont);
  let y = A4.height - contentTop - 38;
  const maxWidth = A4.width - marginX * 2;

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const isHeading = isNoticeHeading(paragraph, paragraphIndex);
    const isMetadata = paragraph.includes("\n") && paragraph.includes(":");
    const font = isHeading ? mediumFont : regularFont;
    const size = isHeading ? 14 : isMetadata ? 8 : 9.5;
    const lineHeight = isHeading ? 18 : isMetadata ? 10.5 : 13;
    const textWidth = isMetadata ? maxWidth - metadataPaddingX * 2 : maxWidth;
    const lines = paragraph.split("\n").flatMap((line) => wrapText(line, font, size, textWidth));
    const metadataTextHeight = size + Math.max(0, lines.length - 1) * lineHeight;
    const blockHeight = isMetadata ? metadataTextHeight + metadataPaddingY * 2 : lines.length * lineHeight;
    const neededHeight = blockHeight + (isHeading ? 16 : isMetadata ? 18 : 10);

    if (isHeading && paragraphIndex > 0) {
      page = addNoticePage(document, mediumFont);
      y = A4.height - contentTop - 38;
    } else if (y - neededHeight < 58) {
      page = addNoticePage(document, mediumFont);
      y = A4.height - contentTop - 38;
    }

    if (isMetadata) {
      const boxTop = y + metadataPaddingY;
      const boxBottom = boxTop - blockHeight;
      page.drawRectangle({
        x: marginX,
        y: boxBottom,
        width: maxWidth,
        height: blockHeight,
        borderColor: ruleColor,
        borderWidth: 0.7,
        color: rgb(0.98, 0.99, 1)
      });

      let metadataY = boxTop - metadataPaddingY - size;
      lines.forEach((line) => {
        page.drawText(line, {
          x: marginX + metadataPaddingX,
          y: metadataY,
          size,
          font,
          color: textColor
        });
        metadataY -= lineHeight;
      });
      y = boxBottom - afterMetadataGap;
      return;
    }

    lines.forEach((line) => {
      page.drawText(line, { x: marginX, y, size, font, color: isHeading ? accentColor : textColor });
      y -= lineHeight;
    });
    y -= isHeading ? 7 : 6;
  });
}

function addNoticePage(document: PDFDocument, font: PDFFont) {
  const page = document.addPage([A4.width, A4.height]);
  page.drawText("Translation notice / Informacja o tłumaczeniu", {
    x: marginX,
    y: A4.height - contentTop + 18,
    size: 9,
    font,
    color: mutedColor
  });
  page.drawLine({
    start: { x: marginX, y: A4.height - contentTop + 7 },
    end: { x: A4.width - marginX, y: A4.height - contentTop + 7 },
    thickness: 1,
    color: ruleColor
  });
  return page;
}

function isNoticeHeading(paragraph: string, paragraphIndex: number) {
  return paragraphIndex === 0 || paragraph === "Informacja o tłumaczeniu";
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }

  if (line) lines.push(line);
  return lines;
}
