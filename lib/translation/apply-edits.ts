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

export interface TranslationEdits {
  items?: ReadonlyArray<ItemEdit>;
  translatedNotes?: string | null;
  footerText?: string | null;
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

  return next;
}
