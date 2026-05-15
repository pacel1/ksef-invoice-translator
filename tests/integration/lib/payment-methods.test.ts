import { describe, expect, it } from "vitest";
import { getPaymentMethodLabel, PAYMENT_METHOD_LABELS } from "@/lib/translation/payment-methods";
import { supportedLanguages } from "@/lib/translation/languages";

describe("payment method labels", () => {
  it("maps MF FA(3) FormaPlatnosci codes", () => {
    expect(getPaymentMethodLabel("1", "pl")).toBe("Gotówka");
    expect(getPaymentMethodLabel("2", "en")).toBe("Card");
    expect(getPaymentMethodLabel("6", "de")).toBe("Überweisung");
    expect(getPaymentMethodLabel("7", "fr")).toBe("Paiement mobile");
    expect(getPaymentMethodLabel("przelew bankowy", "en")).toBe("Bank transfer");
    expect(getPaymentMethodLabel("8", "en")).toBeUndefined();
  });

  it("has labels for every supported translation language", () => {
    for (const language of Object.keys(supportedLanguages)) {
      expect(Object.keys(PAYMENT_METHOD_LABELS[language as keyof typeof supportedLanguages])).toEqual([
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7"
      ]);
    }
  });
});
