/**
 * Editable-field view-model. The parser emits `translationFragments` with
 * machine-readable `kind` + `xmlPath` + `context`. The editor needs a
 * friendlier surface — human labels, sectioning, and a write-back key —
 * but should not invent new technical identifiers; saves still go by the
 * fragment's stable `id`.
 *
 * Keeping the parser's wire shape intact and routing presentation
 * through this module means a kind we don't yet localise still renders
 * (falling back to the raw value) and saves keep working.
 */

import type { TranslationFragment } from "@/types/invoice";

export type EditableSection =
  | "correction"
  | "payment"
  | "settlement"
  | "annotation"
  | "attachment"
  | "fragments";

export interface EditableTranslationField {
  /** Stable parser id — the `/api/translate/edit` write-back key. */
  id: string;
  section: EditableSection;
  /** Localised section name shown above the field. */
  sectionLabel: string;
  /** Localised field label ("Etykieta załącznika", "Termin płatności", …). */
  label: string;
  /** Original Polish text the AI was given. */
  source: string;
  /** Current translation (empty if the AI didn't return anything). */
  translated: string;
  /** Multi-line vs single-line input hint. */
  multiline: boolean;
  /**
   * Optional hint shown next to the label. Falls back to the parser's
   * `context` instruction when nothing more specific is known.
   */
  hint?: string;
  /**
   * Where to locate this field within the source XML. Used for the
   * tooltip / muted breadcrumb under the label. Already humanised.
   */
  xmlPathBreadcrumb: string;
}

interface KindMeta {
  section: EditableSection;
  /** PL label. */
  labelPl: string;
  /** EN label. */
  labelEn: string;
  /** Single-line by default; multi-line for paragraphs, table cells, etc. */
  multiline?: boolean;
}

/**
 * Every parser `kind` we currently emit, with its localised label and
 * section assignment. The fallback `fragments` section keeps the editor
 * functional if the parser starts emitting a brand-new kind before we
 * teach this map about it.
 */
const KIND_META: Record<string, KindMeta> = {
  correction_reason: {
    section: "correction",
    labelPl: "Przyczyna korekty",
    labelEn: "Correction reason",
    multiline: true
  },
  correction_period: {
    section: "correction",
    labelPl: "Okres korekty",
    labelEn: "Correction period"
  },
  annotation_exemption: {
    section: "annotation",
    labelPl: "Podstawa zwolnienia",
    labelEn: "Exemption basis",
    multiline: true
  },
  payment_term: {
    section: "payment",
    labelPl: "Termin płatności",
    labelEn: "Payment term",
    multiline: true
  },
  payment_term_unit: {
    section: "payment",
    labelPl: "Jednostka terminu płatności",
    labelEn: "Payment term unit"
  },
  payment_description: {
    section: "payment",
    labelPl: "Opis płatności",
    labelEn: "Payment description",
    multiline: true
  },
  discount_terms: {
    section: "payment",
    labelPl: "Warunki rabatu",
    labelEn: "Discount terms",
    multiline: true
  },
  settlement_reason: {
    section: "settlement",
    labelPl: "Podstawa rozliczenia",
    labelEn: "Settlement reason",
    multiline: true
  },
  attachment_header: {
    section: "attachment",
    labelPl: "Nagłówek załącznika",
    labelEn: "Attachment header"
  },
  attachment_key: {
    section: "attachment",
    labelPl: "Etykieta załącznika",
    labelEn: "Attachment label"
  },
  attachment_value: {
    section: "attachment",
    labelPl: "Wartość załącznika",
    labelEn: "Attachment value"
  },
  attachment_paragraph: {
    section: "attachment",
    labelPl: "Akapit załącznika",
    labelEn: "Attachment paragraph",
    multiline: true
  },
  attachment_table_description: {
    section: "attachment",
    labelPl: "Opis tabeli załącznika",
    labelEn: "Attachment table description",
    multiline: true
  },
  attachment_table_key: {
    section: "attachment",
    labelPl: "Klucz tabeli załącznika",
    labelEn: "Attachment table key"
  },
  attachment_table_value: {
    section: "attachment",
    labelPl: "Wartość tabeli załącznika",
    labelEn: "Attachment table value"
  },
  attachment_column_header: {
    section: "attachment",
    labelPl: "Nagłówek kolumny",
    labelEn: "Column header"
  },
  attachment_table_cell: {
    section: "attachment",
    labelPl: "Komórka tabeli",
    labelEn: "Table cell"
  },
  attachment_summary_cell: {
    section: "attachment",
    labelPl: "Komórka podsumowania",
    labelEn: "Summary cell"
  }
};

export const SECTION_LABELS_PL: Record<EditableSection, string> = {
  correction: "Korekta",
  payment: "Płatność",
  settlement: "Rozliczenie",
  annotation: "Adnotacje",
  attachment: "Załącznik",
  fragments: "Pozostałe frazy AI"
};

export const SECTION_LABELS_EN: Record<EditableSection, string> = {
  correction: "Correction",
  payment: "Payment",
  settlement: "Settlement",
  annotation: "Annotations",
  attachment: "Attachment",
  fragments: "Other AI phrases"
};

/**
 * Convert the parser's structural xmlPath (mix of element names and
 * numeric array indices) into a human breadcrumb like
 * "Załącznik › BlokDanych › Tabela". Numbers are dropped — they only
 * matter for the technical write-back and would be noise here.
 */
export function xmlPathToBreadcrumb(xmlPath: ReadonlyArray<string | number>): string {
  return xmlPath
    .filter((segment): segment is string => typeof segment === "string")
    .join(" › ");
}

/**
 * Map a single parser fragment to its presentational view-model. The
 * `id` is preserved verbatim — that's the key the editor will use when
 * calling `/api/translate/edit`.
 */
export function fragmentToEditableField(
  fragment: TranslationFragment,
  locale: "pl" | "en" = "pl"
): EditableTranslationField {
  const meta = KIND_META[fragment.kind];
  const sectionLabels = locale === "en" ? SECTION_LABELS_EN : SECTION_LABELS_PL;

  if (meta) {
    const label = locale === "en" ? meta.labelEn : meta.labelPl;
    return {
      id: fragment.id,
      section: meta.section,
      sectionLabel: sectionLabels[meta.section],
      label,
      source: fragment.source,
      translated: fragment.translated ?? "",
      multiline: meta.multiline ?? false,
      hint: fragment.context,
      xmlPathBreadcrumb: xmlPathToBreadcrumb(fragment.xmlPath)
    };
  }

  // Fall back to a generic "fragments" section so unknown kinds still
  // appear in the UI rather than vanishing silently.
  return {
    id: fragment.id,
    section: "fragments",
    sectionLabel: sectionLabels.fragments,
    label: fragment.kind,
    source: fragment.source,
    translated: fragment.translated ?? "",
    multiline: false,
    hint: fragment.context,
    xmlPathBreadcrumb: xmlPathToBreadcrumb(fragment.xmlPath)
  };
}

/**
 * Convenience: turn the whole `translationFragments` array into a list
 * of view-models, optionally filtering by a kind blacklist (e.g. to
 * hide kinds already exposed via a dedicated section).
 */
export function buildEditableFields(
  fragments: ReadonlyArray<TranslationFragment>,
  options: {
    locale?: "pl" | "en";
    excludeKinds?: ReadonlyArray<string>;
  } = {}
): EditableTranslationField[] {
  const exclude = new Set(options.excludeKinds ?? []);
  return fragments
    .filter((f) => !exclude.has(f.kind))
    .map((f) => fragmentToEditableField(f, options.locale ?? "pl"));
}

/**
 * Group view-models by their section, preserving the original order
 * inside each section. Used by the editor to render section headers
 * once instead of repeating them per row.
 */
export function groupEditableFieldsBySection(
  fields: ReadonlyArray<EditableTranslationField>
): Array<{ section: EditableSection; label: string; fields: EditableTranslationField[] }> {
  const groups = new Map<
    EditableSection,
    { section: EditableSection; label: string; fields: EditableTranslationField[] }
  >();
  for (const field of fields) {
    const existing = groups.get(field.section);
    if (existing) {
      existing.fields.push(field);
    } else {
      groups.set(field.section, {
        section: field.section,
        label: field.sectionLabel,
        fields: [field]
      });
    }
  }
  return Array.from(groups.values());
}
