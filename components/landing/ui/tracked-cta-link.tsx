"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { captureClient } from "@/lib/analytics/client";
import type { AnalyticsEventMap } from "@/lib/analytics/events";

type CtaId = AnalyticsEventMap["landing_cta_clicked"]["cta_id"];

interface TrackedCtaLinkProps {
  href: string;
  ctaId: CtaId;
  locale: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

/**
 * Landing CTA link that records `landing_cta_clicked` before navigating.
 * Use from server components (it is a client boundary).
 */
export function TrackedCtaLink({
  href,
  ctaId,
  locale,
  className,
  children,
  onClick
}: TrackedCtaLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        captureClient("landing_cta_clicked", { cta_id: ctaId, locale });
        onClick?.();
      }}
    >
      {children}
    </Link>
  );
}
