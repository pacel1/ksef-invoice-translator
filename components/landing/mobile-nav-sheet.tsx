"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { LandingLocale, NavLink } from "@/lib/landing/copy";
import { captureClient } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

const SHEET_ID = "landing-mobile-nav";

export interface MobileNavSheetProps {
  locale: LandingLocale;
  links: ReadonlyArray<NavLink>;
  ctaHref: string;
  ctaLabel: string;
  openLabel: string;
  closeLabel: string;
  className?: string;
}

export function MobileNavSheet({ locale, links, ctaHref, ctaLabel, openLabel, closeLabel, className }: MobileNavSheetProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const overlay = (
    <div className="fixed inset-0 z-50">
      <div
        data-testid="mobile-nav-backdrop"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/30"
      />
      <div
        id={SHEET_ID}
        role="dialog"
        aria-modal="true"
        aria-label={openLabel}
        className="absolute right-0 top-0 flex h-full w-[min(20rem,85vw)] flex-col gap-2 border-l border-line bg-paper p-5 shadow-raised"
      >
        <div className="mb-2 flex justify-end">
          <button
            ref={closeRef}
            type="button"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-[10px] text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            className="rounded-[10px] px-3 py-3 font-dm text-[17px] text-ink hover:bg-paper-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            {l.label}
          </Link>
        ))}
        <Link
          href={ctaHref}
          onClick={() => {
            captureClient("landing_cta_clicked", { cta_id: "mobile_nav", locale });
            setOpen(false);
          }}
          className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-[11px] bg-brand font-dm font-semibold text-white shadow-brand hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );

  return (
    <div className={cn("md:hidden", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={openLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={SHEET_ID}
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-line text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && typeof document !== "undefined" ? createPortal(overlay, document.body) : null}
    </div>
  );
}

export default MobileNavSheet;
