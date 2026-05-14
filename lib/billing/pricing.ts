export type Currency = "pln";

export interface PriceQuote {
  packageSize: number;
  unitPriceCents: number;
  totalAmountCents: number;
  currency: Currency;
}

export const PACKAGE_SIZES = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100
] as const satisfies readonly number[];

// Canonical PLN ladder (net, bez VAT). Stripe Tax adds 23% VAT at checkout.
// See docs/superpowers/specs/2026-05-13-ksef-saas-design.md §5.
const TIERS: ReadonlyArray<{ min: number; max: number; unitPriceCents: number }> = [
  { min: 5, max: 5, unitPriceCents: 699 },
  { min: 10, max: 20, unitPriceCents: 599 },
  { min: 25, max: 45, unitPriceCents: 499 },
  { min: 50, max: 95, unitPriceCents: 399 },
  { min: 100, max: 100, unitPriceCents: 299 }
];

export function isValidPackageSize(n: unknown): n is number {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= 5 &&
    n <= 100 &&
    n % 5 === 0
  );
}

export class InvalidPackageSizeError extends Error {
  constructor(public readonly value: unknown) {
    super(`Invalid package size: ${String(value)}. Must be a multiple of 5 between 5 and 100.`);
    this.name = "InvalidPackageSizeError";
  }
}

export function priceForPackage(packageSize: number): PriceQuote {
  if (!isValidPackageSize(packageSize)) {
    throw new InvalidPackageSizeError(packageSize);
  }
  const tier = TIERS.find((t) => packageSize >= t.min && packageSize <= t.max);
  if (!tier) {
    // Defensive — should be unreachable given isValidPackageSize.
    throw new InvalidPackageSizeError(packageSize);
  }
  return {
    packageSize,
    unitPriceCents: tier.unitPriceCents,
    totalAmountCents: tier.unitPriceCents * packageSize,
    currency: "pln"
  };
}
