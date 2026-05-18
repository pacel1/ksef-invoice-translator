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
  sm: "h-6 w-6 text-[14px]",
  md: "h-8 w-8 text-[18px]",
  lg: "h-10 w-10 text-[22px]"
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
      <span
        data-brand-bug
        className={`inline-flex items-center justify-center rounded-md bg-accent font-semibold text-white ${BUG_SIZE[size]}`}
        aria-hidden={variant === "full"}
      >
        <span>T</span>
      </span>
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
