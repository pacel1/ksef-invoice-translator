"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { Invoice, LanguageCode } from "@/types/invoice";
import type { Copy } from "@/lib/workspace/copy";
import {
  buildEditableFields,
  groupEditableFieldsBySection
} from "@/lib/translation/editable-fields";
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
  /** Per-row edits to invoice.additionalDescriptions (key/value pairs). */
  additionalKeys: Record<number, string>;
  additionalValues: Record<number, string>;
  /** invoice.correction.translatedReason and translatedPeriod. */
  correctionReason: string;
  correctionPeriod: string;
  /** Per-order-line edits, keyed by "orderIndex.lineIndex". */
  orderLineNames: Record<string, string>;
  orderLineUnits: Record<string, string>;
  /** Per-charge/deduction translated reasons, keyed by index. */
  settlementChargeReasons: Record<number, string>;
  settlementDeductionReasons: Record<number, string>;
  /** Per-translation-fragment translated text, keyed by fragment id. */
  fragmentTranslations: Record<string, string>;
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
    footer: "",
    additionalKeys: {},
    additionalValues: {},
    correctionReason: "",
    correctionPeriod: "",
    orderLineNames: {},
    orderLineUnits: {},
    settlementChargeReasons: {},
    settlementDeductionReasons: {},
    fragmentTranslations: {}
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
          footer: loaded.footer?.translatedText ?? "",
          additionalKeys: Object.fromEntries(
            (loaded.additionalDescriptions ?? []).map((entry, i) => [
              i,
              entry.translatedKey ?? ""
            ])
          ),
          additionalValues: Object.fromEntries(
            (loaded.additionalDescriptions ?? []).map((entry, i) => [
              i,
              entry.translatedValue ?? ""
            ])
          ),
          correctionReason: loaded.correction?.translatedReason ?? "",
          correctionPeriod: loaded.correction?.translatedPeriod ?? "",
          orderLineNames: Object.fromEntries(
            (loaded.orders ?? []).flatMap((order, oIdx) =>
              (order.lines ?? []).map((line, lIdx) => [
                `${oIdx}.${lIdx}`,
                line.translatedName ?? ""
              ])
            )
          ),
          orderLineUnits: Object.fromEntries(
            (loaded.orders ?? []).flatMap((order, oIdx) =>
              (order.lines ?? []).map((line, lIdx) => [
                `${oIdx}.${lIdx}`,
                line.translatedUnit ?? ""
              ])
            )
          ),
          settlementChargeReasons: Object.fromEntries(
            (loaded.settlements?.charges ?? []).map((line, i) => [
              i,
              line.translatedReason ?? ""
            ])
          ),
          settlementDeductionReasons: Object.fromEntries(
            (loaded.settlements?.deductions ?? []).map((line, i) => [
              i,
              line.translatedReason ?? ""
            ])
          ),
          fragmentTranslations: Object.fromEntries(
            (loaded.translationFragments ?? []).map((fragment) => [
              fragment.id,
              fragment.translated ?? ""
            ])
          )
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
      const additionalDescriptions = (invoice.additionalDescriptions ?? []).map(
        (_, i) => ({
          index: i,
          translatedKey: draft.additionalKeys[i] ?? null,
          translatedValue: draft.additionalValues[i] ?? null
        })
      );
      const correction = invoice.correction
        ? {
            translatedReason: draft.correctionReason,
            translatedPeriod: draft.correctionPeriod
          }
        : undefined;

      const orderLines = (invoice.orders ?? []).flatMap((order, oIdx) =>
        (order.lines ?? []).map((_, lIdx) => ({
          orderIndex: oIdx,
          lineIndex: lIdx,
          translatedName: draft.orderLineNames[`${oIdx}.${lIdx}`] ?? null,
          translatedUnit: draft.orderLineUnits[`${oIdx}.${lIdx}`] ?? null
        }))
      );
      const settlementCharges = (invoice.settlements?.charges ?? []).map(
        (_, i) => ({
          index: i,
          translatedReason: draft.settlementChargeReasons[i] ?? null
        })
      );
      const settlementDeductions = (invoice.settlements?.deductions ?? []).map(
        (_, i) => ({
          index: i,
          translatedReason: draft.settlementDeductionReasons[i] ?? null
        })
      );
      const translationFragments = (invoice.translationFragments ?? []).map(
        (fragment) => ({
          id: fragment.id,
          translated: draft.fragmentTranslations[fragment.id] ?? null
        })
      );

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
            footerText: invoice.footer ? draft.footer : undefined,
            additionalDescriptions: additionalDescriptions.length > 0 ? additionalDescriptions : undefined,
            correction,
            orderLines: orderLines.length > 0 ? orderLines : undefined,
            settlementCharges: settlementCharges.length > 0 ? settlementCharges : undefined,
            settlementDeductions: settlementDeductions.length > 0 ? settlementDeductions : undefined,
            translationFragments: translationFragments.length > 0 ? translationFragments : undefined
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
  const additionalDescriptions = invoice.additionalDescriptions ?? [];
  const hasAdditional = additionalDescriptions.length > 0;
  const hasCorrection = Boolean(invoice.correction);
  const orders = invoice.orders ?? [];
  const hasOrderLines = orders.some((o) => (o.lines ?? []).length > 0);
  const charges = invoice.settlements?.charges ?? [];
  const deductions = invoice.settlements?.deductions ?? [];
  const hasSettlements = charges.length > 0 || deductions.length > 0;
  // Fragments backing correction reason/period are already exposed via
  // the dedicated Correction section above. Avoid double-editing by
  // hiding those specific kinds from the generic fragments block.
  const fragments = (invoice.translationFragments ?? []).filter(
    (fragment) =>
      fragment.kind !== "correction_reason" &&
      fragment.kind !== "correction_period"
  );
  const hasFragments = fragments.length > 0;

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

      {hasAdditional ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-small font-semibold text-text-strong">
            {String(copy.editorAdditionalLabel)}
          </h3>
          <ul className="flex flex-col gap-3">
            {additionalDescriptions.map((entry, idx) => (
              <li
                key={`${entry.lineNumber ?? idx}-${idx}`}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <p className="mb-2 text-micro text-text-muted">
                  {entry.key ? (
                    <span className="font-medium">{entry.key}: </span>
                  ) : null}
                  {entry.value}
                </p>
                <label className="block">
                  <span className="text-micro text-text-muted">
                    {String(copy.editorAdditionalKeyLabel)}
                  </span>
                  <input
                    type="text"
                    value={draft.additionalKeys[idx] ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        additionalKeys: {
                          ...prev.additionalKeys,
                          [idx]: e.target.value
                        }
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-small text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-micro text-text-muted">
                    {String(copy.editorAdditionalValueLabel)}
                  </span>
                  <textarea
                    value={draft.additionalValues[idx] ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        additionalValues: {
                          ...prev.additionalValues,
                          [idx]: e.target.value
                        }
                      }))
                    }
                    rows={2}
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-small text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasCorrection ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-small font-semibold text-text-strong">
            {String(copy.editorCorrectionLabel)}
          </h3>
          {invoice.correction?.reason ? (
            <label className="block">
              <span className="text-micro text-text-muted">
                {String(copy.editorCorrectionReasonLabel)}
              </span>
              <span className="mt-1 block text-micro text-text-muted">
                {invoice.correction.reason}
              </span>
              <textarea
                value={draft.correctionReason}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    correctionReason: e.target.value
                  }))
                }
                rows={2}
                className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-small text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
          ) : null}
          {invoice.correction?.period ? (
            <label className="block">
              <span className="text-micro text-text-muted">
                {String(copy.editorCorrectionPeriodLabel)}
              </span>
              <span className="mt-1 block text-micro text-text-muted">
                {invoice.correction.period}
              </span>
              <input
                type="text"
                value={draft.correctionPeriod}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    correctionPeriod: e.target.value
                  }))
                }
                className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-small text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
          ) : null}
        </section>
      ) : null}

      {hasOrderLines ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-small font-semibold text-text-strong">
            {String(copy.editorOrdersLabel)}
          </h3>
          {orders.map((order, oIdx) => {
            const lines = order.lines ?? [];
            if (lines.length === 0) return null;
            return (
              <div key={`order-${oIdx}`} className="flex flex-col gap-2">
                <p className="text-micro text-text-muted">
                  {String(copy.editorOrderLabel)} {oIdx + 1}
                  {order.orderNumber ? ` · ${order.orderNumber}` : ""}
                </p>
                <ul className="flex flex-col gap-3">
                  {lines.map((line, lIdx) => {
                    const key = `${oIdx}.${lIdx}`;
                    return (
                      <li
                        key={`order-line-${oIdx}-${lIdx}`}
                        className="rounded-lg border border-border bg-surface p-3"
                      >
                        <p className="mb-2 text-micro text-text-muted">
                          {lIdx + 1}. {line.name ?? "—"}
                        </p>
                        <label className="block">
                          <span className="text-micro text-text-muted">
                            {String(copy.editorOrderLineNameLabel)}
                          </span>
                          <input
                            type="text"
                            value={draft.orderLineNames[key] ?? ""}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                orderLineNames: {
                                  ...prev.orderLineNames,
                                  [key]: e.target.value
                                }
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-small text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </label>
                        <label className="mt-3 block">
                          <span className="text-micro text-text-muted">
                            {String(copy.editorOrderLineUnitLabel)} ({line.unit ?? "—"})
                          </span>
                          <input
                            type="text"
                            value={draft.orderLineUnits[key] ?? ""}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                orderLineUnits: {
                                  ...prev.orderLineUnits,
                                  [key]: e.target.value
                                }
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-small text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      ) : null}

      {hasSettlements ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-small font-semibold text-text-strong">
            {String(copy.editorSettlementsLabel)}
          </h3>
          {charges.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {charges.map((charge, idx) => (
                <li
                  key={`charge-${idx}`}
                  className="rounded-lg border border-border bg-surface p-3"
                >
                  <p className="mb-2 text-micro text-text-muted">
                    {idx + 1}. {charge.reason ?? "—"}
                  </p>
                  <label className="block">
                    <span className="text-micro text-text-muted">
                      {String(copy.editorSettlementChargeLabel)}
                    </span>
                    <textarea
                      value={draft.settlementChargeReasons[idx] ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          settlementChargeReasons: {
                            ...prev.settlementChargeReasons,
                            [idx]: e.target.value
                          }
                        }))
                      }
                      rows={2}
                      className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-small text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
          {deductions.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {deductions.map((deduction, idx) => (
                <li
                  key={`deduction-${idx}`}
                  className="rounded-lg border border-border bg-surface p-3"
                >
                  <p className="mb-2 text-micro text-text-muted">
                    {idx + 1}. {deduction.reason ?? "—"}
                  </p>
                  <label className="block">
                    <span className="text-micro text-text-muted">
                      {String(copy.editorSettlementDeductionLabel)}
                    </span>
                    <textarea
                      value={draft.settlementDeductionReasons[idx] ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          settlementDeductionReasons: {
                            ...prev.settlementDeductionReasons,
                            [idx]: e.target.value
                          }
                        }))
                      }
                      rows={2}
                      className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-small text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {hasFragments ? (
        <FragmentSections
          fragments={fragments}
          draft={draft}
          setDraft={setDraft}
          locale={copy.editorFragmentsLabel === "AI-translated phrases" ? "en" : "pl"}
        />
      ) : null}
    </div>
  );
}

interface FragmentSectionsProps {
  fragments: Invoice["translationFragments"];
  draft: DraftState;
  setDraft: React.Dispatch<React.SetStateAction<DraftState>>;
  locale: "pl" | "en";
}

/**
 * Renders the parser's `translationFragments` as a unified set of
 * EditableTranslationField groups — friendly section labels (Korekta,
 * Załącznik, Płatność, …) with human field names ("Etykieta załącznika"
 * instead of "attachment_key"). The save key stays the parser's stable
 * fragment.id so /api/translate/edit doesn't need to change.
 */
function FragmentSections({
  fragments,
  draft,
  setDraft,
  locale
}: FragmentSectionsProps) {
  const groups = useMemo(() => {
    const fields = buildEditableFields(fragments ?? [], { locale });
    return groupEditableFieldsBySection(fields);
  }, [fragments, locale]);

  return (
    <>
      {groups.map((group) => (
        <section key={group.section} className="flex flex-col gap-3">
          <h3 className="text-small font-semibold text-text-strong">
            {group.label}
          </h3>
          <ul className="flex flex-col gap-3">
            {group.fields.map((field) => (
              <li
                key={`field-${field.id}`}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <div className="mb-2 flex flex-col gap-0.5">
                  <span className="text-small font-medium text-text-strong">
                    {field.label}
                  </span>
                  {field.xmlPathBreadcrumb ? (
                    <span className="text-micro text-text-muted">
                      {field.xmlPathBreadcrumb}
                    </span>
                  ) : null}
                  <p className="mt-1 text-small text-text">{field.source}</p>
                </div>
                {field.multiline ? (
                  <textarea
                    value={draft.fragmentTranslations[field.id] ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        fragmentTranslations: {
                          ...prev.fragmentTranslations,
                          [field.id]: e.target.value
                        }
                      }))
                    }
                    rows={3}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-small text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                ) : (
                  <input
                    type="text"
                    value={draft.fragmentTranslations[field.id] ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        fragmentTranslations: {
                          ...prev.fragmentTranslations,
                          [field.id]: e.target.value
                        }
                      }))
                    }
                    className="h-10 w-full rounded-md border border-border bg-surface px-3 text-small text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
