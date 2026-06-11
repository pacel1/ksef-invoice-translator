import { describe, it, expect } from "vitest";
import { renderPaymentConfirmationEmail } from "@/emails/render-payment-confirmation";

/** Intl formats PLN with non-breaking spaces; normalize for stable assertions. */
function normalizeSpaces(s: string): string {
  return s.replace(/[  ]/g, " ");
}

describe("renderPaymentConfirmationEmail", () => {
  const baseInput = {
    packageSize: 25,
    amountPaidCents: 15375,
    currency: "pln",
    recipientEmail: "ksiegowosc@firma.pl"
  };

  it("renders the PL email with payment and KSeF delivery info", async () => {
    const result = await renderPaymentConfirmationEmail({
      ...baseInput,
      locale: "pl"
    });

    expect(result.subject).toMatch(/płatność potwierdzona/i);
    expect(result.html).toContain("25 kredytów");
    expect(normalizeSpaces(result.html)).toContain("153,75 zł");
    expect(result.html).toContain("KSeF");
    expect(result.html).toContain(baseInput.recipientEmail);
  });

  it("renders the EN email with payment and KSeF delivery info", async () => {
    const result = await renderPaymentConfirmationEmail({
      ...baseInput,
      locale: "en"
    });

    expect(result.subject).toMatch(/payment confirmed/i);
    expect(result.html).toContain("25 credits");
    expect(normalizeSpaces(result.html)).toMatch(/PLN\s*153\.75/);
    expect(result.html).toContain("KSeF");
  });

  it("explains that the invoice arrives via KSeF, not by email, in plain text too", async () => {
    const pl = await renderPaymentConfirmationEmail({ ...baseInput, locale: "pl" });
    const en = await renderPaymentConfirmationEmail({ ...baseInput, locale: "en" });

    expect(pl.plainText).toContain("KSeF");
    expect(pl.plainText).toMatch(/NIP/);
    expect(en.plainText).toContain("KSeF");
    expect(en.plainText).toMatch(/NIP/);
  });

  it("falls back to EN for an unknown locale", async () => {
    const result = await renderPaymentConfirmationEmail({
      ...baseInput,
      locale: "de"
    });
    expect(result.subject).toMatch(/payment confirmed/i);
  });

  it("contains no em or en dashes in subject or plain text (copy rule)", async () => {
    for (const locale of ["pl", "en"] as const) {
      const result = await renderPaymentConfirmationEmail({ ...baseInput, locale });
      expect(result.subject).not.toMatch(/[–—]/);
      expect(result.plainText).not.toMatch(/[–—]/);
    }
  });

  it("rejects a non-positive package size", async () => {
    await expect(
      renderPaymentConfirmationEmail({ ...baseInput, locale: "pl", packageSize: 0 })
    ).rejects.toThrow(/package/i);
  });

  it("rejects a negative amount", async () => {
    await expect(
      renderPaymentConfirmationEmail({
        ...baseInput,
        locale: "pl",
        amountPaidCents: -100
      })
    ).rejects.toThrow(/amount/i);
  });
});
