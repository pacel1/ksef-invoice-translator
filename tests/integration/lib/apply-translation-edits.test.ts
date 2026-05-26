import { describe, it, expect } from "vitest";
import { applyTranslationEdits } from "@/lib/translation/apply-edits";
import type { Invoice } from "@/types/invoice";

function makeInvoice(): Invoice {
  return {
    invoiceNumber: "FA-2026-0001",
    issueDate: "2026-05-01",
    currency: "PLN",
    items: [
      {
        name: "Usługa programistyczna",
        translatedName: "Programming service",
        quantity: 10,
        unit: "h",
        translatedUnit: "hr",
        unitPrice: 250,
        netValue: 2500,
        vatRate: "23",
        grossValue: 3075
      },
      {
        name: "Konsultacje",
        translatedName: "Consultation",
        quantity: 2,
        unit: "godz.",
        translatedUnit: "hour",
        unitPrice: 500,
        netValue: 1000,
        vatRate: "23",
        grossValue: 1230
      }
    ],
    notes: "Płatność w terminie 14 dni.",
    translatedNotes: "Payment due in 14 days.",
    footer: {
      text: "Spółka wpisana do KRS",
      translatedText: "Company registered in the National Court Registry"
    }
  } as unknown as Invoice;
}

describe("applyTranslationEdits", () => {
  it("returns a NEW invoice (immutable)", () => {
    const original = makeInvoice();
    const updated = applyTranslationEdits(original, {
      translatedNotes: "Payment in 14 days, please."
    });
    expect(updated).not.toBe(original);
    expect(original.translatedNotes).toBe("Payment due in 14 days.");
  });

  it("updates a single item's translatedName by index", () => {
    const invoice = makeInvoice();
    const updated = applyTranslationEdits(invoice, {
      items: [{ index: 0, translatedName: "Software engineering service" }]
    });
    expect(updated.items[0].translatedName).toBe("Software engineering service");
    expect(updated.items[1].translatedName).toBe("Consultation");
  });

  it("updates translatedUnit independently of translatedName", () => {
    const updated = applyTranslationEdits(makeInvoice(), {
      items: [{ index: 1, translatedUnit: "hours" }]
    });
    expect(updated.items[1].translatedUnit).toBe("hours");
    expect(updated.items[1].translatedName).toBe("Consultation");
  });

  it("clears a translated field when given an empty string", () => {
    const updated = applyTranslationEdits(makeInvoice(), {
      items: [{ index: 0, translatedName: "" }]
    });
    expect(updated.items[0].translatedName).toBeUndefined();
  });

  it("clears a translated field when given null explicitly", () => {
    const updated = applyTranslationEdits(makeInvoice(), {
      translatedNotes: null
    });
    expect(updated.translatedNotes).toBeUndefined();
  });

  it("ignores out-of-range item indices silently", () => {
    const updated = applyTranslationEdits(makeInvoice(), {
      items: [{ index: 99, translatedName: "should not apply" }]
    });
    expect(updated.items).toHaveLength(2);
    expect(updated.items[0].translatedName).toBe("Programming service");
  });

  it("does not touch fields not in the edits payload", () => {
    const original = makeInvoice();
    const updated = applyTranslationEdits(original, {
      translatedNotes: "Edited notes"
    });
    expect(updated.items[0].translatedName).toBe(original.items[0].translatedName);
    expect(updated.footer?.translatedText).toBe(original.footer?.translatedText);
  });

  it("updates the footer translation when footerText is provided", () => {
    const updated = applyTranslationEdits(makeInvoice(), {
      footerText: "Registered: KRS 0001234567"
    });
    expect(updated.footer?.translatedText).toBe("Registered: KRS 0001234567");
    expect(updated.footer?.text).toBe("Spółka wpisana do KRS");
  });

  it("updates additionalDescriptions translatedKey + translatedValue per row", () => {
    const base = {
      ...makeInvoice(),
      additionalDescriptions: [
        { key: "Pieczęć", value: "Dział finansowy", translatedKey: "Stamp", translatedValue: "Finance dept" },
        { key: "Uwagi", value: "Płatność przelewem", translatedKey: undefined, translatedValue: undefined }
      ]
    } as unknown as Invoice;

    const updated = applyTranslationEdits(base, {
      additionalDescriptions: [
        { index: 0, translatedValue: "Finance department" },
        { index: 1, translatedKey: "Notes", translatedValue: "Bank transfer payment" }
      ]
    });

    expect(updated.additionalDescriptions?.[0].translatedValue).toBe("Finance department");
    expect(updated.additionalDescriptions?.[0].translatedKey).toBe("Stamp");
    expect(updated.additionalDescriptions?.[1].translatedKey).toBe("Notes");
    expect(updated.additionalDescriptions?.[1].translatedValue).toBe(
      "Bank transfer payment"
    );
  });

  it("updates correction.translatedReason + translatedPeriod when correction exists", () => {
    const base = {
      ...makeInvoice(),
      correction: {
        reason: "Błędna stawka VAT",
        period: "2026-04",
        translatedReason: undefined,
        translatedPeriod: undefined
      }
    } as unknown as Invoice;

    const updated = applyTranslationEdits(base, {
      correction: {
        translatedReason: "Incorrect VAT rate",
        translatedPeriod: "April 2026"
      }
    });

    expect(updated.correction?.translatedReason).toBe("Incorrect VAT rate");
    expect(updated.correction?.translatedPeriod).toBe("April 2026");
    expect(updated.correction?.reason).toBe("Błędna stawka VAT");
  });

  it("ignores correction edits when invoice has no correction block", () => {
    const updated = applyTranslationEdits(makeInvoice(), {
      correction: { translatedReason: "shouldn't apply" }
    });
    expect(updated.correction).toBeUndefined();
  });

  it("returns an invoice with a different items reference (no mutation)", () => {
    const original = makeInvoice();
    const updated = applyTranslationEdits(original, {
      items: [{ index: 0, translatedName: "New name" }]
    });
    expect(updated.items).not.toBe(original.items);
    expect(updated.items[0]).not.toBe(original.items[0]);
  });

  it("updates an order line's translatedName and translatedUnit by (orderIndex, lineIndex)", () => {
    const base = {
      ...makeInvoice(),
      orders: [
        {
          orderNumber: "PO-1",
          lines: [
            { name: "Wykonanie usługi", translatedName: "Service execution", unit: "szt.", translatedUnit: "pcs" },
            { name: "Dodatek", translatedName: "Surcharge", unit: "h", translatedUnit: "hr" }
          ]
        }
      ]
    } as unknown as Invoice;

    const updated = applyTranslationEdits(base, {
      orderLines: [
        { orderIndex: 0, lineIndex: 0, translatedName: "Performance of services" },
        { orderIndex: 0, lineIndex: 1, translatedUnit: "hours" }
      ]
    });

    expect(updated.orders?.[0].lines?.[0].translatedName).toBe(
      "Performance of services"
    );
    expect(updated.orders?.[0].lines?.[0].translatedUnit).toBe("pcs");
    expect(updated.orders?.[0].lines?.[1].translatedUnit).toBe("hours");
    expect(updated.orders?.[0].lines?.[1].translatedName).toBe("Surcharge");
  });

  it("ignores out-of-range order/line indices silently", () => {
    const base = {
      ...makeInvoice(),
      orders: [{ lines: [{ name: "x", translatedName: "X" }] }]
    } as unknown as Invoice;
    const updated = applyTranslationEdits(base, {
      orderLines: [
        { orderIndex: 99, lineIndex: 0, translatedName: "nope" },
        { orderIndex: 0, lineIndex: 99, translatedName: "nope" }
      ]
    });
    expect(updated.orders?.[0].lines?.[0].translatedName).toBe("X");
  });

  it("updates settlement charge and deduction translatedReason by index", () => {
    const base = {
      ...makeInvoice(),
      settlements: {
        charges: [
          { type: "charge", amount: 100, reason: "Opóźnienie", translatedReason: "Delay" }
        ],
        deductions: [
          { type: "deduction", amount: 50, reason: "Rabat", translatedReason: "Discount" }
        ]
      }
    } as unknown as Invoice;

    const updated = applyTranslationEdits(base, {
      settlementCharges: [{ index: 0, translatedReason: "Late delivery surcharge" }],
      settlementDeductions: [{ index: 0, translatedReason: "Volume rebate" }]
    });

    expect(updated.settlements?.charges?.[0].translatedReason).toBe(
      "Late delivery surcharge"
    );
    expect(updated.settlements?.deductions?.[0].translatedReason).toBe(
      "Volume rebate"
    );
  });

  it("updates a translationFragment's translated text by id", () => {
    const base = {
      ...makeInvoice(),
      translationFragments: [
        {
          id: "fragment.correction.reason",
          kind: "correction_reason",
          source: "Błąd w stawce",
          translated: "Mistake in rate",
          xmlPath: ["Fa", "Korekta", "Powod"]
        }
      ]
    } as unknown as Invoice;

    const updated = applyTranslationEdits(base, {
      translationFragments: [
        { id: "fragment.correction.reason", translated: "Incorrect VAT rate" }
      ]
    });

    expect(updated.translationFragments?.[0].translated).toBe(
      "Incorrect VAT rate"
    );
    // Source must not be touched.
    expect(updated.translationFragments?.[0].source).toBe("Błąd w stawce");
  });

  it("clears a translationFragment's translated when set to empty string", () => {
    const base = {
      ...makeInvoice(),
      translationFragments: [
        {
          id: "fragment.x",
          kind: "annotation",
          source: "X",
          translated: "Y",
          xmlPath: ["a"]
        }
      ]
    } as unknown as Invoice;

    const updated = applyTranslationEdits(base, {
      translationFragments: [{ id: "fragment.x", translated: "" }]
    });
    expect(updated.translationFragments?.[0].translated).toBeUndefined();
  });

  it("ignores translationFragment edits with unknown ids", () => {
    const base = {
      ...makeInvoice(),
      translationFragments: [
        {
          id: "fragment.known",
          kind: "k",
          source: "S",
          translated: "T",
          xmlPath: []
        }
      ]
    } as unknown as Invoice;
    const updated = applyTranslationEdits(base, {
      translationFragments: [{ id: "fragment.unknown", translated: "shouldn't apply" }]
    });
    expect(updated.translationFragments?.[0].translated).toBe("T");
    expect(updated.translationFragments).toHaveLength(1);
  });
});

function baseInvoiceWithCorrection(): Invoice {
  return {
    invoiceNumber: "FA/1",
    issueDate: "2026-05-01",
    currency: "PLN",
    seller: { name: "Acme" },
    buyer: { name: "Beta" },
    items: [],
    totals: { net: 100, vat: 23, gross: 123 },
    correction: {
      reason: "Błąd w stawce VAT",
      translatedReason: "VAT rate error (AI)",
      period: "2026-04",
      translatedPeriod: "April 2026 (AI)"
    },
    translationFragments: [
      {
        id: "fragment-correction-reason-1",
        kind: "correction_reason",
        source: "Błąd w stawce VAT",
        translated: "VAT rate error (AI)",
        xmlPath: ["Fa", "Korekta", "Przyczyna"]
      },
      {
        id: "fragment-correction-period-1",
        kind: "correction_period",
        source: "2026-04",
        translated: "April 2026 (AI)",
        xmlPath: ["Fa", "Korekta", "Okres"]
      }
    ]
  } as unknown as Invoice;
}

describe("applyTranslationEdits — correction/fragment sync", () => {
  it("mirrors correction.translatedReason onto the matching translationFragment", () => {
    const before = baseInvoiceWithCorrection();
    const after = applyTranslationEdits(before, {
      correction: { translatedReason: "VAT rate error (corrected by user)" }
    });
    expect(after.correction?.translatedReason).toBe(
      "VAT rate error (corrected by user)"
    );
    const fragment = after.translationFragments?.find(
      (f) => f.kind === "correction_reason"
    );
    expect(fragment?.translated).toBe("VAT rate error (corrected by user)");
  });

  it("mirrors correction.translatedPeriod onto the matching fragment", () => {
    const before = baseInvoiceWithCorrection();
    const after = applyTranslationEdits(before, {
      correction: { translatedPeriod: "April 2026 (user)" }
    });
    expect(after.correction?.translatedPeriod).toBe("April 2026 (user)");
    const fragment = after.translationFragments?.find(
      (f) => f.kind === "correction_period"
    );
    expect(fragment?.translated).toBe("April 2026 (user)");
  });

  it("clearing the correction reason ALSO clears the matching fragment translation", () => {
    const before = baseInvoiceWithCorrection();
    const after = applyTranslationEdits(before, {
      correction: { translatedReason: "" }
    });
    expect(after.correction?.translatedReason).toBeUndefined();
    const fragment = after.translationFragments?.find(
      (f) => f.kind === "correction_reason"
    );
    expect(fragment?.translated).toBeUndefined();
  });

  it("correction edit beats a contradicting translationFragment edit submitted in the same payload", () => {
    // This is the realistic shape: the editor sends ALL fragments back with
    // their cached values, including correction_reason. The user's correction
    // edit must still win.
    const before = baseInvoiceWithCorrection();
    const after = applyTranslationEdits(before, {
      correction: { translatedReason: "User's edit" },
      translationFragments: [
        {
          id: "fragment-correction-reason-1",
          translated: "Stale AI value"
        }
      ]
    });
    expect(after.correction?.translatedReason).toBe("User's edit");
    const fragment = after.translationFragments?.find(
      (f) => f.id === "fragment-correction-reason-1"
    );
    expect(fragment?.translated).toBe("User's edit");
  });

  it("when no correction edits are present, fragments are left untouched", () => {
    const before = baseInvoiceWithCorrection();
    const after = applyTranslationEdits(before, {
      translatedNotes: "Just notes"
    });
    const fragmentsBefore = before.translationFragments ?? [];
    const fragmentsAfter = after.translationFragments ?? [];
    expect(fragmentsAfter).toEqual(fragmentsBefore);
  });

  it("user-edited fragment with no correction edit is still applied normally", () => {
    // Regression guard: the mirror logic only fires when edits.correction is
    // present. Pure fragment edits should still go through unmodified.
    const before = baseInvoiceWithCorrection();
    const after = applyTranslationEdits(before, {
      translationFragments: [
        {
          id: "fragment-correction-reason-1",
          translated: "Direct fragment edit"
        }
      ]
    });
    const fragment = after.translationFragments?.find(
      (f) => f.id === "fragment-correction-reason-1"
    );
    expect(fragment?.translated).toBe("Direct fragment edit");
  });
});
