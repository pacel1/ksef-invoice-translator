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
  const color = rgb(0.39, 0.46, 0.55);
  for (const page of document.getPages()) {
    const { width } = page.getSize();
    const lines = wrapText(notice, font, 7, width - marginX * 2).slice(0, 2);
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: marginX,
        y: footerY + (lines.length - index - 1) * 8,
        size: 7,
        font,
        color
      });
    });
  }
}

function drawTranslationNoticePages(document: PDFDocument, regularFont: PDFFont, mediumFont: PDFFont, notice: string) {
  const paragraphs = notice.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (!paragraphs.length) return;

  let page = document.addPage([A4.width, A4.height]);
  let y = A4.height - contentTop;
  const maxWidth = A4.width - marginX * 2;
  const color = rgb(0.12, 0.16, 0.22);

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const isHeading = paragraphIndex === 0;
    const font = isHeading ? mediumFont : regularFont;
    const size = isHeading ? 14 : 9.5;
    const lineHeight = isHeading ? 18 : 13;
    const lines = paragraph.split("\n").flatMap((line) => wrapText(line, font, size, maxWidth));
    const neededHeight = lines.length * lineHeight + (isHeading ? 14 : 9);

    if (y - neededHeight < 58) {
      page = document.addPage([A4.width, A4.height]);
      y = A4.height - contentTop;
    }

    lines.forEach((line) => {
      page.drawText(line, { x: marginX, y, size, font, color });
      y -= lineHeight;
    });
    y -= isHeading ? 8 : 5;
  });
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
