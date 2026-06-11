import Link from "next/link";

export type BrandLockupSize = "sm" | "md" | "lg";
export type BrandLockupVariant = "full" | "bug-only";

export interface BrandLockupProps {
  /** Wraps the lockup in a Next.js Link when set. Omit for non-clickable headers. */
  href?: string;
  size?: BrandLockupSize;
  variant?: BrandLockupVariant;
  className?: string;
}

const BUG_SIZE: Record<BrandLockupSize, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10"
};

const WORDMARK_SIZE: Record<BrandLockupSize, string> = {
  sm: "text-small",
  md: "text-body",
  lg: "text-h3"
};

const GAP: Record<BrandLockupSize, string> = {
  sm: "gap-1.5",
  md: "gap-2",
  lg: "gap-3"
};

export function BrandLockup({
  href,
  size = "md",
  variant = "full",
  className = ""
}: BrandLockupProps) {
  const inner = (
    <span className={`inline-flex items-center ${GAP[size]} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no optimization needed */}
      <img
        data-brand-bug
        src="/brand/sygnet.svg"
        alt=""
        className={BUG_SIZE[size]}
      />
      {variant === "full" ? (
        <span className={`font-semibold tracking-tight text-text-strong ${WORDMARK_SIZE[size]}`}>
          Tłumacz Faktur KSeF
        </span>
      ) : null}
    </span>
  );
  if (href) {
    return (
      <Link href={href} aria-label="Tłumacz Faktur KSeF">
        {inner}
      </Link>
    );
  }
  return inner;
}
