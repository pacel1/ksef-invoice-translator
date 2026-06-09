import { describe, it, expect } from "vitest";
import { SHOWCASE_ORDER, SHOWCASE_LANGS, SHOWCASE_FIXED, SHOWCASE_CYCLE_MS } from "@/lib/landing/invoice-showcase";

describe("invoice showcase data", () => {
  it("cycles exactly the six languages in order, starting with PL", () => {
    expect(SHOWCASE_ORDER).toEqual(["PL", "EN", "DE", "FR", "ES", "IT"]);
  });

  it("has a full label set for every language", () => {
    for (const code of SHOWCASE_ORDER) {
      const L = SHOWCASE_LANGS[code];
      for (const key of ["title", "number", "issue", "buyer", "nip", "item", "total", "cur", "lock", "status"] as const) {
        expect(L[key]).toBeTruthy();
      }
    }
  });

  it("shows zł for PL and PLN for every other language (currency localizes, value does not)", () => {
    expect(SHOWCASE_LANGS.PL.cur).toBe("zł");
    for (const code of ["EN", "DE", "FR", "ES", "IT"] as const) {
      expect(SHOWCASE_LANGS[code].cur).toBe("PLN");
    }
  });

  it("exposes the fixed (locked) invoice values and a cycle interval", () => {
    expect(SHOWCASE_FIXED.number).toBeTruthy();
    expect(SHOWCASE_FIXED.total).toBeTruthy();
    expect(SHOWCASE_CYCLE_MS).toBeGreaterThan(1000);
  });

  it("contains no em or en dashes", () => {
    expect(JSON.stringify({ SHOWCASE_LANGS, SHOWCASE_FIXED })).not.toMatch(/—|–/);
  });
});
