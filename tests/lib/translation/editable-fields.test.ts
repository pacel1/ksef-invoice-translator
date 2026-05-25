import { describe, it, expect } from "vitest";
import {
  buildEditableFields,
  fragmentToEditableField,
  groupEditableFieldsBySection,
  xmlPathToBreadcrumb
} from "@/lib/translation/editable-fields";
import type { TranslationFragment } from "@/types/invoice";

function frag(
  overrides: Partial<TranslationFragment> = {}
): TranslationFragment {
  return {
    id: "fragment.0",
    kind: "attachment_key",
    source: "Miejsce poboru energii",
    translated: "Place of energy consumption",
    xmlPath: ["Zalacznik", "BlokDanych", "Tabela", 0],
    context: "attachment label",
    ...overrides
  };
}

describe("xmlPathToBreadcrumb", () => {
  it("joins string segments with the › separator and drops numbers", () => {
    expect(
      xmlPathToBreadcrumb(["Zalacznik", "BlokDanych", "Tabela", 0])
    ).toBe("Zalacznik › BlokDanych › Tabela");
  });

  it("returns an empty string for an empty path", () => {
    expect(xmlPathToBreadcrumb([])).toBe("");
  });
});

describe("fragmentToEditableField", () => {
  it("maps attachment_key to the Załącznik section + the friendly Polish label", () => {
    const field = fragmentToEditableField(frag());
    expect(field.section).toBe("attachment");
    expect(field.sectionLabel).toBe("Załącznik");
    expect(field.label).toBe("Etykieta załącznika");
  });

  it("emits the English label when locale='en'", () => {
    const field = fragmentToEditableField(frag(), "en");
    expect(field.label).toBe("Attachment label");
    expect(field.sectionLabel).toBe("Attachment");
  });

  it("preserves the parser id verbatim — that's the save key", () => {
    const field = fragmentToEditableField(frag({ id: "fragment.42" }));
    expect(field.id).toBe("fragment.42");
  });

  it("falls back to the generic fragments section for an unknown kind", () => {
    const field = fragmentToEditableField(frag({ kind: "brand_new_kind" }));
    expect(field.section).toBe("fragments");
    expect(field.label).toBe("brand_new_kind");
  });

  it("marks paragraph-shaped kinds as multiline", () => {
    expect(
      fragmentToEditableField(frag({ kind: "attachment_paragraph" })).multiline
    ).toBe(true);
    expect(
      fragmentToEditableField(frag({ kind: "attachment_key" })).multiline
    ).toBe(false);
  });

  it("includes the humanised xml path as a breadcrumb", () => {
    const field = fragmentToEditableField(frag());
    expect(field.xmlPathBreadcrumb).toBe("Zalacznik › BlokDanych › Tabela");
  });

  it("returns an empty string for missing translated text rather than undefined", () => {
    const field = fragmentToEditableField(frag({ translated: undefined }));
    expect(field.translated).toBe("");
  });
});

describe("buildEditableFields", () => {
  it("converts every fragment by default", () => {
    const fields = buildEditableFields([
      frag({ id: "fragment.0", kind: "attachment_key" }),
      frag({ id: "fragment.1", kind: "payment_term" })
    ]);
    expect(fields).toHaveLength(2);
    expect(fields.map((f) => f.id)).toEqual(["fragment.0", "fragment.1"]);
  });

  it("respects excludeKinds — used to hide correction_* which has its own section", () => {
    const fields = buildEditableFields(
      [
        frag({ id: "fragment.0", kind: "correction_reason" }),
        frag({ id: "fragment.1", kind: "attachment_key" })
      ],
      { excludeKinds: ["correction_reason", "correction_period"] }
    );
    expect(fields).toHaveLength(1);
    expect(fields[0].id).toBe("fragment.1");
  });
});

describe("groupEditableFieldsBySection", () => {
  it("groups by section and keeps within-section order", () => {
    const fields = buildEditableFields([
      frag({ id: "a", kind: "attachment_key" }),
      frag({ id: "b", kind: "payment_term" }),
      frag({ id: "c", kind: "attachment_value" })
    ]);
    const groups = groupEditableFieldsBySection(fields);
    expect(groups.map((g) => g.section)).toEqual(["attachment", "payment"]);
    expect(groups[0].fields.map((f) => f.id)).toEqual(["a", "c"]);
    expect(groups[1].fields.map((f) => f.id)).toEqual(["b"]);
  });
});
