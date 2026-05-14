import { describe, it, expect } from "vitest";
import { renderAuthEmail, type SupabaseEmailActionType } from "@/emails/render-template";

describe("renderAuthEmail", () => {
  const baseInput = {
    link: "https://ksef-invoice-translator.vercel.app/auth/callback?token_hash=abc&type=email",
    recipientEmail: "test@example.com"
  };

  it("renders the PL magic-link email with a Polish subject", async () => {
    const result = await renderAuthEmail({
      ...baseInput,
      locale: "pl",
      actionType: "magiclink"
    });

    expect(result.subject).toMatch(/zaloguj/i);
    expect(result.html).toContain("Zaloguj się jednym kliknięciem");
    expect(result.html).toContain(baseInput.link);
    expect(result.plainText).toContain(baseInput.link);
  });

  it("renders the EN magic-link email with an English subject", async () => {
    const result = await renderAuthEmail({
      ...baseInput,
      locale: "en",
      actionType: "magiclink"
    });

    expect(result.subject).toMatch(/sign in/i);
    expect(result.html).toContain("One-click sign-in");
  });

  it("uses a signup-flavored subject for action_type='signup' but the same template", async () => {
    const result = await renderAuthEmail({
      ...baseInput,
      locale: "en",
      actionType: "signup"
    });
    expect(result.subject).toMatch(/sign in/i);
    expect(result.html).toContain("One-click sign-in");
  });

  it("uses a recovery-flavored subject for action_type='recovery'", async () => {
    const result = await renderAuthEmail({
      ...baseInput,
      locale: "en",
      actionType: "recovery"
    });
    expect(result.subject).toMatch(/sign in|recover/i);
  });

  it("falls back to EN for an unknown locale", async () => {
    const result = await renderAuthEmail({
      ...baseInput,
      locale: "de" as unknown as "pl" | "en",
      actionType: "magiclink"
    });
    expect(result.subject).toMatch(/sign in/i);
  });

  it("inlines the link into both html and plainText", async () => {
    const result = await renderAuthEmail({
      ...baseInput,
      locale: "pl",
      actionType: "magiclink"
    });
    expect(result.html).toContain(baseInput.link);
    expect(result.plainText).toContain(baseInput.link);
  });
});

export type _ExportToSatisfyVitestModule = SupabaseEmailActionType;
