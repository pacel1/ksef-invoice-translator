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

  it("returns an invoice with a different items reference (no mutation)", () => {
    const original = makeInvoice();
    const updated = applyTranslationEdits(original, {
      items: [{ index: 0, translatedName: "New name" }]
    });
    expect(updated.items).not.toBe(original.items);
    expect(updated.items[0]).not.toBe(original.items[0]);
  });
});
