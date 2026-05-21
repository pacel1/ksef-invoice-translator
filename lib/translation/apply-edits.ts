import type { Invoice } from "@/types/invoice";

/**
 * Per-item edit payload — only the free-text fields are editable.
 * Amount, IBAN, NIP, dates, etc. live on the invoice as immutable
 * data and are never touched by user edits.
 */
export interface ItemEdit {
  /** 0-based index into invoice.items */
  index: number;
  translatedName?: string | null;
  translatedUnit?: string | null;
}

export interface AdditionalDescriptionEdit {
  /** 0-based index into invoice.additionalDescriptions */
  index: number;
  translatedKey?: string | null;
  translatedValue?: string | null;
}

export interface CorrectionEdits {
  translatedReason?: string | null;
  translatedPeriod?: string | null;
}

export interface OrderLineEdit {
  /** 0-based index into invoice.orders */
  orderIndex: number;
  /** 0-based index into orders[orderIndex].lines */
  lineIndex: number;
  translatedName?: string | null;
  translatedUnit?: string | null;
}

export interface SettlementLineEdit {
  /** 0-based index into invoice.settlements.charges or .deductions */
  index: number;
  translatedReason?: string | null;
}

export interface TranslationFragmentEdit {
  /** Fragment id (matches invoice.translationFragments[*].id) */
  id: string;
  translated?: string | null;
}

export interface TranslationEdits {
  items?: ReadonlyArray<ItemEdit>;
  translatedNotes?: string | null;
  footerText?: string | null;
  /** Per-row edits to invoice.additionalDescriptions (key/value pairs). */
  additionalDescriptions?: ReadonlyArray<AdditionalDescriptionEdit>;
  /** Edits to invoice.correction translations (corrected invoices only). */
  correction?: CorrectionEdits;
  /** Edits to invoice.orders[*].lines[*] free-text (name + unit). */
  orderLines?: ReadonlyArray<OrderLineEdit>;
  /** Edits to invoice.settlements.charges[*].translatedReason. */
  settlementCharges?: ReadonlyArray<SettlementLineEdit>;
  /** Edits to invoice.settlements.deductions[*].translatedReason. */
  settlementDeductions?: ReadonlyArray<SettlementLineEdit>;
  /**
   * Edits to invoice.translationFragments[*].translated. Keyed by the
   * stable fragment.id so reordering on the server doesn't drift edits.
   * Unknown ids are silently ignored — defense against stale clients.
   */
  translationFragments?: ReadonlyArray<TranslationFragmentEdit>;
}

/**
 * Apply user edits onto a translated Invoice. Returns a NEW Invoice
 * (immutable per ~/.claude/rules/common/coding-style.md). null/empty
 * values clear the field; undefined leaves it as-is.
 *
 * Out-of-range item indices are silently ignored — defense against
 * stale clients editing an invoice that was re-fetched mid-edit and
 * has a different items list now.
 */
export function applyTranslationEdits(
  invoice: Invoice,
  edits: TranslationEdits
): Invoice {
  let nextItems = invoice.items;
  if (edits.items && edits.items.length > 0) {
    nextItems = invoice.items.map((item, idx) => {
      const edit = edits.items?.find((e) => e.index === idx);
      if (!edit) return item;
      const next = { ...item };
      if (edit.translatedName !== undefined) {
        if (edit.translatedName === null || edit.translatedName.trim() === "") {
          delete next.translatedName;
        } else {
          next.translatedName = edit.translatedName;
        }
      }
      if (edit.translatedUnit !== undefined) {
        if (edit.translatedUnit === null || edit.translatedUnit.trim() === "") {
          delete next.translatedUnit;
        } else {
          next.translatedUnit = edit.translatedUnit;
        }
      }
      return next;
    });
  }

  const next: Invoice = { ...invoice, items: nextItems };

  if (edits.translatedNotes !== undefined) {
    if (edits.translatedNotes === null || edits.translatedNotes.trim() === "") {
      delete next.translatedNotes;
    } else {
      next.translatedNotes = edits.translatedNotes;
    }
  }

  if (edits.footerText !== undefined && next.footer) {
    const nextFooter = { ...next.footer };
    if (edits.footerText === null || edits.footerText.trim() === "") {
      delete nextFooter.translatedText;
    } else {
      nextFooter.translatedText = edits.footerText;
    }
    next.footer = nextFooter;
  }

  if (edits.additionalDescriptions && edits.additionalDescriptions.length > 0) {
    const source = next.additionalDescriptions ?? [];
    const updated = source.map((entry, idx) => {
      const edit = edits.additionalDescriptions?.find((e) => e.index === idx);
      if (!edit) return entry;
      const nextEntry = { ...entry };
      if (edit.translatedKey !== undefined) {
        if (edit.translatedKey === null || edit.translatedKey.trim() === "") {
          delete nextEntry.translatedKey;
        } else {
          nextEntry.translatedKey = edit.translatedKey;
        }
      }
      if (edit.translatedValue !== undefined) {
        if (edit.translatedValue === null || edit.translatedValue.trim() === "") {
          delete nextEntry.translatedValue;
        } else {
          nextEntry.translatedValue = edit.translatedValue;
        }
      }
      return nextEntry;
    });
    next.additionalDescriptions = updated;
  }

  if (edits.correction && next.correction) {
    const nextCorrection = { ...next.correction };
    if (edits.correction.translatedReason !== undefined) {
      if (
        edits.correction.translatedReason === null ||
        edits.correction.translatedReason.trim() === ""
      ) {
        delete nextCorrection.translatedReason;
      } else {
        nextCorrection.translatedReason = edits.correction.translatedReason;
      }
    }
    if (edits.correction.translatedPeriod !== undefined) {
      if (
        edits.correction.translatedPeriod === null ||
        edits.correction.translatedPeriod.trim() === ""
      ) {
        delete nextCorrection.translatedPeriod;
      } else {
        nextCorrection.translatedPeriod = edits.correction.translatedPeriod;
      }
    }
    next.correction = nextCorrection;
  }

  if (edits.orderLines && edits.orderLines.length > 0 && next.orders) {
    next.orders = next.orders.map((order, oIdx) => {
      const orderEdits = edits.orderLines?.filter((e) => e.orderIndex === oIdx);
      if (!orderEdits || orderEdits.length === 0 || !order.lines) return order;
      return {
        ...order,
        lines: order.lines.map((line, lIdx) => {
          const edit = orderEdits.find((e) => e.lineIndex === lIdx);
          if (!edit) return line;
          const nextLine = { ...line };
          if (edit.translatedName !== undefined) {
            if (edit.translatedName === null || edit.translatedName.trim() === "") {
              delete nextLine.translatedName;
            } else {
              nextLine.translatedName = edit.translatedName;
            }
          }
          if (edit.translatedUnit !== undefined) {
            if (edit.translatedUnit === null || edit.translatedUnit.trim() === "") {
              delete nextLine.translatedUnit;
            } else {
              nextLine.translatedUnit = edit.translatedUnit;
            }
          }
          return nextLine;
        })
      };
    });
  }

  if (
    (edits.settlementCharges?.length || edits.settlementDeductions?.length) &&
    next.settlements
  ) {
    const nextSettlements = { ...next.settlements };
    if (edits.settlementCharges?.length && nextSettlements.charges) {
      nextSettlements.charges = nextSettlements.charges.map((line, idx) => {
        const edit = edits.settlementCharges?.find((e) => e.index === idx);
        if (!edit || edit.translatedReason === undefined) return line;
        const nextLine = { ...line };
        if (edit.translatedReason === null || edit.translatedReason.trim() === "") {
          delete nextLine.translatedReason;
        } else {
          nextLine.translatedReason = edit.translatedReason;
        }
        return nextLine;
      });
    }
    if (edits.settlementDeductions?.length && nextSettlements.deductions) {
      nextSettlements.deductions = nextSettlements.deductions.map((line, idx) => {
        const edit = edits.settlementDeductions?.find((e) => e.index === idx);
        if (!edit || edit.translatedReason === undefined) return line;
        const nextLine = { ...line };
        if (edit.translatedReason === null || edit.translatedReason.trim() === "") {
          delete nextLine.translatedReason;
        } else {
          nextLine.translatedReason = edit.translatedReason;
        }
        return nextLine;
      });
    }
    next.settlements = nextSettlements;
  }

  if (
    edits.translationFragments &&
    edits.translationFragments.length > 0 &&
    next.translationFragments
  ) {
    const byId = new Map(
      edits.translationFragments.map((e) => [e.id, e] as const)
    );
    next.translationFragments = next.translationFragments.map((fragment) => {
      const edit = byId.get(fragment.id);
      if (!edit || edit.translated === undefined) return fragment;
      const nextFragment = { ...fragment };
      if (edit.translated === null || edit.translated.trim() === "") {
        delete nextFragment.translated;
      } else {
        nextFragment.translated = edit.translated;
      }
      return nextFragment;
    });
  }

  return next;
}
