"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export interface NewTranslationLinkProps {
  /** Localized label, e.g. "+ Nowe tłumaczenie" or "+ New translation". */
  label: string;
  /**
   * "full" → wide pill (sidebar expanded). "collapsed" → 40px square icon
   * button (sidebar collapsed rail). Both behave identically on click.
   */
  variant: "full" | "collapsed";
}

/**
 * Always-fresh navigation to the wizard. Plain <Link href="/translate"> is
 * insufficient: when the user is currently on /translate?invoiceId=<uuid>,
 * App Router's same-pathname soft nav can serve the cached server payload
 * via the Router Cache, leaving the wizard mounted on the delivery step.
 * router.push + router.refresh guarantees both URL change AND server re-fetch.
 */
export function NewTranslationLink({ label, variant }: NewTranslationLinkProps) {
  const router = useRouter();

  function handleClick() {
    router.push("/translate");
    router.refresh();
  }

  if (variant === "collapsed") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        title={label}
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md bg-accent text-white shadow-sm transition-colors duration-hover hover:bg-accent-hover"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1 rounded-md bg-accent px-4 text-small font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {label.replace(/^\+\s*/, "")}
    </button>
  );
}
