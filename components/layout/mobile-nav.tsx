"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileNavLink {
  href: string;
  label: string;
}

export interface MobileNavProps {
  links: ReadonlyArray<MobileNavLink>;
  cta: MobileNavLink;
  openLabel: string;
  closeLabel: string;
  className?: string;
}

const SHEET_ID = "mobile-nav-sheet";

const navLinkClass =
  "flex min-h-[44px] items-center rounded-md px-3 py-2 text-body text-text hover:text-text-strong";
const ctaClass =
  "inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-small font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors duration-hover ease-out";

export function MobileNav({ links, cta, openLabel, closeLabel, className }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  // Close on Escape while open. Listener attached only while open and cleaned up on close/unmount.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Lock body scroll while the sheet is open; restore on close/unmount. SSR-safe guard.
  useEffect(() => {
    if (typeof document === "undefined" || !open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className={cn(className)}>
      <button
        type="button"
        aria-label={openLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={SHEET_ID}
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-text hover:text-text-strong"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-default bg-black/30"
          />
          <div
            id={SHEET_ID}
            role="dialog"
            aria-modal="true"
            aria-label={openLabel}
            className="absolute right-0 top-0 flex h-full w-[min(20rem,85vw)] flex-col border-l border-border bg-surface p-5 shadow-lg"
          >
            <div className="flex items-center justify-end">
              <button
                type="button"
                aria-label={closeLabel}
                aria-expanded={open}
                onClick={close}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-text hover:text-text-strong"
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <nav className="mt-2 flex flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  className={navLinkClass}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto pt-4">
              <Link href={cta.href} onClick={close} className={ctaClass}>
                {cta.label}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MobileNav;
