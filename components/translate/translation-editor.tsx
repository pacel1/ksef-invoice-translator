"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { Invoice, LanguageCode } from "@/types/invoice";
import type { Copy } from "@/lib/workspace/copy";
import { cn } from "@/lib/utils";

export interface TranslationEditorProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  language: LanguageCode;
  bilingual: boolean;
  copy: Copy;
  /** Called with the updated Invoice after a successful save. */
  onSaved: (invoice: Invoice) => void;
}

interface DraftState {
  itemNames: Record<number, string>;
  itemUnits: Record<number, string>;
  notes: string;
  footer: string;
}

/**
 * Right-side drawer for editing free-text translations after the AI
 * pass. Loads the cached translation lazily when the drawer opens
 * (no extra round-trip if the user never clicks Edytuj), shows one
 * input per editable field, sends edits to /api/translate/edit on
 * save.
 *
 * Out of scope: amounts, NIP/IBAN, dates, vat rates — those live on
 * the invoice as immutable data and the editor doesn't surface them.
 * Spec §1 (Trust & Authority): money fields are never user-edited.
 */
export function TranslationEditor({
  open,
  onClose,
  invoiceId,
  language,
  bilingual,
  copy,
  onSaved
}: TranslationEditorProps) {
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [draft, setDraft] = useState<DraftState>({
    itemNames: {},
    itemUnits: {},
    notes: "",
    footer: ""
  });
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Lazy load on open so we don't pay the round-trip until the user
  // actually opens the editor.
  useEffect(() => {
    if (!open) return;
    setLoadingInvoice(true);
    setErrorMessage(null);
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, language, bilingual })
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`fetch failed (${res.status})`);
        const payload = (await res.json()) as { invoice: Invoice };
        return payload.invoice;
      })
      .then((loaded) => {
        setInvoice(loaded);
        setDraft({
          itemNames: Object.fromEntries(
            (loaded.items ?? []).map((item, i) => [i, item.translatedName ?? ""])
          ),
          itemUnits: Object.fromEntries(
            (loaded.items ?? []).map((item, i) => [i, item.translatedUnit ?? ""])
          ),
          notes: loaded.translatedNotes ?? "",
          footer: loaded.footer?.translatedText ?? ""
        });
      })
      .catch((err) => {
        console.error("[editor] load failed:", err);
        setErrorMessage(String(copy.editorSaveFailedToast));
      })
      .finally(() => setLoadingInvoice(false));
  }, [open, invoiceId, language, bilingual, copy.editorSaveFailedToast]);

  const save = useCallback(async () => {
    if (!invoice) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const items = (invoice.items ?? []).map((_, i) => ({
        index: i,
        translatedName: draft.itemNames[i] ?? null,
        translatedUnit: draft.itemUnits[i] ?? null
      }));
      const res = await fetch("/api/translate/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          language,
          bilingual,
          edits: {
            items,
            translatedNotes: draft.notes,
            footerText: invoice.footer ? draft.footer : undefined
          }
        })
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      const payload = (await res.json()) as { invoice: Invoice };
      onSaved(payload.invoice);
      onClose();
    } catch (err) {
      console.error("[editor] save failed:", err);
      setErrorMessage(String(copy.editorSaveFailedToast));
    } finally {
      setSaving(false);
    }
  }, [
    invoice,
    draft,
    invoiceId,
    language,
    bilingual,
    onClose,
    onSaved,
    copy.editorSaveFailedToast
  ]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={String(copy.editorTitle)}
      className="fixed inset-0 z-50 flex justify-end bg-text-strong/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-2xl flex-col bg-surface shadow-lg">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-h3 text-text-strong">
              {String(copy.editorTitle)}
            </h2>
            <p className="text-small text-text-muted">
              {String(copy.editorSubtitle)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label={String(copy.editorCloseCta)}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors duration-hover hover:bg-surface-muted hover:text-text-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loadingInvoice ? (
            <div className="flex items-center justify-center py-12 text-text-muted">
              <Loader2
                className="mr-2 h-5 w-5 animate-spin"
                aria-hidden="true"
              />
              {String(copy.parsingRow)}
            </div>
          ) : invoice ? (
            <EditorFields
              invoice={invoice}
              draft={draft}
              setDraft={setDraft}
              copy={copy}
            />
          ) : (
            <p className="text-small text-text-muted">
              {String(copy.editorNoFieldsHint)}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          {errorMessage ? (
            <p className="text-small text-danger" role="alert">
              {errorMessage}
            </p>
          ) : (
            <span aria-hidden="true" />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface px-5 text-small font-medium text-text-strong shadow-sm hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {String(copy.editorCancelCta)}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !invoice}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50",
                !saving && invoice && "cursor-pointer"
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {saving
                ? String(copy.editorSavingCta)
                : String(copy.editorSaveCta)}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

interface EditorFieldsProps {
  invoice: Invoice;
  draft: DraftState;
  setDraft: (next: DraftState | ((prev: DraftState) => DraftState)) => void;
  copy: Copy;
}

function EditorFields({ invoice, draft, setDraft, copy }: EditorFieldsProps) {
  const hasItems = (invoice.items ?? []).length > 0;
  const hasFooter = Boolean(invoice.footer);

  return (
    <div className="flex flex-col gap-6">
      {hasItems ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-small font-semibold text-text-strong">
            {String(copy.editorItemNameLabel)} / {String(copy.editorItemUnitLabel)}
          </h3>
          <ul className="flex flex-col gap-3">
            {invoice.items.map((item, idx) => (
              <li
                key={`${item.lineNumber ?? idx}-${idx}`}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <p className="mb-2 text-micro text-text-muted">
                  {idx + 1}. {item.name}
                </p>
                <label className="block">
                  <span className="text-micro text-text-muted">
                    {String(copy.editorItemNameLabel)}
                  </span>
                  <input
                    type="text"
                    value={draft.itemNames[idx] ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        itemNames: { ...prev.itemNames, [idx]: e.target.value }
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-small text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-micro text-text-muted">
                    {String(copy.editorItemUnitLabel)} ({item.unit ?? "—"})
                  </span>
                  <input
                    type="text"
                    value={draft.itemUnits[idx] ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        itemUnits: { ...prev.itemUnits, [idx]: e.target.value }
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-small text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <label className="block">
          <span className="text-small font-semibold text-text-strong">
            {String(copy.editorNotesLabel)}
          </span>
          {invoice.notes ? (
            <span className="mt-1 block text-micro text-text-muted">
              {invoice.notes}
            </span>
          ) : null}
          <textarea
            value={draft.notes}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, notes: e.target.value }))
            }
            rows={3}
            className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-small text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
      </section>

      {hasFooter ? (
        <section className="flex flex-col gap-2">
          <label className="block">
            <span className="text-small font-semibold text-text-strong">
              {String(copy.editorFooterLabel)}
            </span>
            {invoice.footer?.text ? (
              <span className="mt-1 block text-micro text-text-muted">
                {invoice.footer.text}
              </span>
            ) : null}
            <textarea
              value={draft.footer}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, footer: e.target.value }))
              }
              rows={2}
              className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-small text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
        </section>
      ) : null}
    </div>
  );
}
