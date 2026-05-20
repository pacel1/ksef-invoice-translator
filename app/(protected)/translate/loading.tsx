import { Loader2 } from "lucide-react";

/**
 * Next.js automatic loading UI for /translate. Shown by the App Router
 * while the server-side render of TranslatePage is in flight — most
 * commonly when the user clicks a Recent/History row and we have to
 * fetch the invoice + latest translation before hydrating the wizard.
 *
 * Minimal on purpose — we don't know yet which step the wizard will
 * land on (cached translation → Step 3 preview, no translation → Step
 * 2 picker, or fresh /translate → Step 1 upload), so we don't draw a
 * misleading skeleton of a specific step. Just a centered spinner with
 * a status label so the user knows something is happening.
 */
export default function TranslateLoading() {
  return (
    <div className="-mx-5 -my-8 flex md:-mx-8">
      {/* Sidebar placeholder — matches the real sidebar's width so the
          layout doesn't jump when the real page hydrates. */}
      <div
        aria-hidden="true"
        className="hidden w-60 shrink-0 border-r border-border bg-surface-muted/60 md:block"
      />
      <main className="flex-1 px-5 py-8 md:px-8">
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-text-muted">
          <Loader2 className="h-7 w-7 animate-spin text-accent" aria-hidden="true" />
          <p className="text-small" aria-live="polite">
            Ładuję…
          </p>
        </div>
      </main>
    </div>
  );
}
