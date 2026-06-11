import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  sendPaymentConfirmationEmail,
  type EmailSendInput
} from "@/lib/billing/payment-confirmation-email";

function fakeSupabase(locale: string | null): SupabaseClient<Database> {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: locale === null ? null : { locale },
            error: null
          })
        })
      })
    })
  } as unknown as SupabaseClient<Database>;
}

function captureSend(result: { id?: string } | null = { id: "email_123" }) {
  const sent: EmailSendInput[] = [];
  const sendEmail = vi.fn(async (input: EmailSendInput) => {
    sent.push(input);
    return { data: result, error: null };
  });
  return { sent, sendEmail };
}

const baseOpts = {
  appUrl: "https://kseftranslator.pl",
  userId: "user-1",
  recipientEmail: "ksiegowosc@firma.pl",
  packageSize: 25,
  amountPaidCents: 15375,
  currency: "pln"
};

describe("sendPaymentConfirmationEmail", () => {
  it("sends the PL email from billing@<host> when the profile locale is pl", async () => {
    const { sent, sendEmail } = captureSend();

    const result = await sendPaymentConfirmationEmail({
      ...baseOpts,
      supabase: fakeSupabase("pl"),
      sendEmail
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sent[0].to).toBe("ksiegowosc@firma.pl");
    expect(sent[0].from).toBe("KSeF Translator <billing@kseftranslator.pl>");
    expect(sent[0].subject).toMatch(/płatność potwierdzona/i);
    expect(sent[0].html).toContain("25 kredytów");
    expect(sent[0].text).toContain("KSeF");
    expect(result.providerId).toBe("email_123");
  });

  it("sends the EN email when the profile locale is en", async () => {
    const { sent, sendEmail } = captureSend();

    await sendPaymentConfirmationEmail({
      ...baseOpts,
      supabase: fakeSupabase("en"),
      sendEmail
    });

    expect(sent[0].subject).toMatch(/payment confirmed/i);
    expect(sent[0].html).toContain("25 credits");
  });

  it("defaults to PL when no profile row exists (checkout is PL-NIP only)", async () => {
    const { sent, sendEmail } = captureSend();

    await sendPaymentConfirmationEmail({
      ...baseOpts,
      supabase: fakeSupabase(null),
      sendEmail
    });

    expect(sent[0].subject).toMatch(/płatność potwierdzona/i);
  });

  it("honors an explicit fromAddress override", async () => {
    const { sent, sendEmail } = captureSend();

    await sendPaymentConfirmationEmail({
      ...baseOpts,
      supabase: fakeSupabase("pl"),
      sendEmail,
      fromAddress: "KSeF Translator <noreply@example.com>"
    });

    expect(sent[0].from).toBe("KSeF Translator <noreply@example.com>");
  });

  it("throws when the provider reports a send error", async () => {
    const sendEmail = vi.fn(async () => ({
      data: null,
      error: { message: "rate limited" }
    }));

    await expect(
      sendPaymentConfirmationEmail({
        ...baseOpts,
        supabase: fakeSupabase("pl"),
        sendEmail
      })
    ).rejects.toThrow(/rate limited/);
  });
});
