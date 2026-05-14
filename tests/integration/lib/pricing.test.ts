import { describe, it, expect } from "vitest";
import {
  PACKAGE_SIZES,
  isValidPackageSize,
  priceForPackage
} from "@/lib/billing/pricing";

describe("PACKAGE_SIZES", () => {
  it("is the slider domain 5..100 step 5", () => {
    expect(PACKAGE_SIZES).toEqual([
      5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100
    ]);
  });
});

describe("isValidPackageSize", () => {
  it("accepts multiples of 5 between 5 and 100", () => {
    for (const n of [5, 10, 25, 50, 100]) {
      expect(isValidPackageSize(n)).toBe(true);
    }
  });

  it("rejects 0, negatives, off-grid values, and out-of-range", () => {
    for (const n of [0, -5, 1, 4, 6, 7, 11, 101, 105, 1000]) {
      expect(isValidPackageSize(n)).toBe(false);
    }
  });

  it("rejects non-integers and NaN", () => {
    expect(isValidPackageSize(5.5)).toBe(false);
    expect(isValidPackageSize(Number.NaN)).toBe(false);
  });
});

describe("priceForPackage", () => {
  it("returns the canonical ladder", () => {
    // 5 -> 6.99 zł/inv = 34.95 zł total
    expect(priceForPackage(5)).toEqual({
      packageSize: 5,
      unitPriceCents: 699,
      totalAmountCents: 3495,
      currency: "pln"
    });
    // 10, 15, 20 -> 5.99 zł/inv
    expect(priceForPackage(10).unitPriceCents).toBe(599);
    expect(priceForPackage(10).totalAmountCents).toBe(5990);
    expect(priceForPackage(15).unitPriceCents).toBe(599);
    expect(priceForPackage(20).unitPriceCents).toBe(599);
    // 25..45 -> 4.99 zł/inv
    expect(priceForPackage(25).unitPriceCents).toBe(499);
    expect(priceForPackage(45).unitPriceCents).toBe(499);
    // 50..95 -> 3.99 zł/inv
    expect(priceForPackage(50).unitPriceCents).toBe(399);
    expect(priceForPackage(95).unitPriceCents).toBe(399);
    // 100 -> 2.99 zł/inv = 299 zł total
    expect(priceForPackage(100)).toEqual({
      packageSize: 100,
      unitPriceCents: 299,
      totalAmountCents: 29900,
      currency: "pln"
    });
  });

  it("throws on invalid sizes", () => {
    expect(() => priceForPackage(7)).toThrow();
    expect(() => priceForPackage(0)).toThrow();
    expect(() => priceForPackage(101)).toThrow();
  });
});
