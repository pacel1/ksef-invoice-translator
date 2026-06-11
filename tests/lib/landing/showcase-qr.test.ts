import { describe, it, expect } from "vitest";
import QRCode from "qrcode";
import {
  SHOWCASE_QR_TEXT,
  SHOWCASE_QR_EC_LEVEL,
  SHOWCASE_QR_SIZE,
  SHOWCASE_QR_ROWS
} from "@/lib/landing/showcase-qr";
import { qrSvgPath } from "@/lib/landing/qr-svg";

describe("showcase QR data", () => {
  it("encodes the production URL uppercased so it fits the smallest (21x21) QR version", () => {
    expect(SHOWCASE_QR_TEXT).toBe("HTTPS://TLUMACZKSEF.PL");
    expect(SHOWCASE_QR_SIZE).toBe(21);
  });

  it("matches the matrix the qrcode library produces for the same input, so it stays scannable", () => {
    const qr = QRCode.create(SHOWCASE_QR_TEXT, {
      errorCorrectionLevel: SHOWCASE_QR_EC_LEVEL
    });
    expect(qr.modules.size).toBe(SHOWCASE_QR_SIZE);
    const expected: string[] = [];
    for (let y = 0; y < qr.modules.size; y++) {
      let row = "";
      for (let x = 0; x < qr.modules.size; x++) {
        row += qr.modules.get(y, x) ? "1" : "0";
      }
      expected.push(row);
    }
    expect([...SHOWCASE_QR_ROWS]).toEqual(expected);
  });

  it("is a square matrix of 0/1 strings", () => {
    expect(SHOWCASE_QR_ROWS).toHaveLength(SHOWCASE_QR_SIZE);
    for (const row of SHOWCASE_QR_ROWS) {
      expect(row).toMatch(new RegExp(`^[01]{${SHOWCASE_QR_SIZE}}$`));
    }
  });
});

describe("qrSvgPath", () => {
  it("emits one unit square per dark module", () => {
    expect(qrSvgPath(["10", "01"])).toBe("M0 0h1v1h-1zM1 1h1v1h-1z");
  });

  it("returns an empty path for an all-light matrix", () => {
    expect(qrSvgPath(["00", "00"])).toBe("");
  });
});
