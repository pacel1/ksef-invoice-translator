"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, HelpCircle, History, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CollapsibleSidebarLabels {
  newInvoiceLabel: string;
  recentHeading: string;
  allArchive: string;
  helpLabel: string;
  expandLabel: string;
  collapseLabel: string;
}

export interface CollapsibleSidebarProps {
  /** Recent invoice rows — pre-rendered server-side; we just toggle visibility. */
  children: ReactNode;
  labels: CollapsibleSidebarLabels;
  /**
   * Default collapsed state — server uses URL params to decide. Once on the
   * client, localStorage takes over so the choice persists between visits.
   */
  defaultCollapsed?: boolean;
}

const STORAGE_KEY = "translate.sidebar.collapsed";

/**
 * Client wrapper around the (server-rendered) recent-invoices content.
 * Adds a collapse toggle so the user can reclaim ~180px of horizontal
 * space when reviewing a PDF preview.
 *
 * Hydration order:
 *   1. SSR renders with width matching `defaultCollapsed`
 *   2. Client useEffect reads localStorage and updates if it disagrees
 *   3. Toggle flips state + writes to localStorage
 */
export function CollapsibleSidebar({
  children,
  labels,
  defaultCollapsed = false
}: CollapsibleSidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
      else if (stored === "0") setCollapsed(false);
      // else: respect the SSR default
    } catch {
      // localStorage unavailable (private mode / hardened browser) — fall back
      // to the SSR default, no state change.
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore — best-effort persistence
      }
      return next;
    });
  }

  if (collapsed) {
    return (
      <aside
        aria-label={labels.recentHeading}
        className="hidden w-14 shrink-0 flex-col items-center border-r border-border bg-surface-muted/60 py-6 md:flex"
      >
        <Link
          href="/translate"
          aria-label={labels.newInvoiceLabel}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md bg-accent text-white shadow-sm transition-colors duration-hover hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/translate/history"
          aria-label={labels.allArchive}
          className="mt-4 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors duration-hover hover:bg-surface hover:text-text-strong"
        >
          <History className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/security"
          aria-label={labels.helpLabel}
          className="mt-4 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors duration-hover hover:bg-surface hover:text-text-strong"
        >
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={labels.expandLabel}
          className="mt-auto inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors duration-hover hover:bg-surface hover:text-text-strong"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </aside>
    );
  }

  return (
    <div className="relative hidden md:block">
      {children}
      <button
        type="button"
        onClick={toggle}
        aria-label={labels.collapseLabel}
        title={labels.collapseLabel}
        className={cn(
          "absolute top-6 -right-3 z-10 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-text-muted shadow-sm transition-colors duration-hover hover:border-accent hover:text-accent"
        )}
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
