import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { renderPaymentConfirmationEmail } from "@/emails/render-payment-confirmation";
import { resolveFromAddress } from "@/lib/email/from-address";
import type { EmailSendFn } from "@/lib/email/types";

export type { EmailSendInput, EmailSendResult, EmailSendFn } from "@/lib/email/types";

export interface SendPaymentConfirmationOptions {
  supabase: SupabaseClient<Database>;
  sendEmail: EmailSendFn;
  appUrl: string;
  /** Sender override; defaults to `billing@<APP_HOST>`. */
  fromAddress?: string;
  userId: string;
  recipientEmail: string;
  packageSize: number;
  /** Gross amount actually charged, in minor units (grosze). */
  amountPaidCents: number;
  currency: string;
}

/**
 * Render and send the post-payment confirmation email. The email tells the
 * buyer their credits are active and that the VAT invoice arrives via KSeF,
 * not by email. Throws on provider failure — callers decide whether the
 * failure is fatal (the Stripe webhook treats it as best-effort).
 */
export async function sendPaymentConfirmationEmail(
  opts: SendPaymentConfirmationOptions
): Promise<{ providerId: string | null }> {
  const locale = await lookupLocale(opts.supabase, opts.userId);

  const { subject, html, plainText } = await renderPaymentConfirmationEmail({
    locale,
    packageSize: opts.packageSize,
    amountPaidCents: opts.amountPaidCents,
    currency: opts.currency,
    recipientEmail: opts.recipientEmail
  });

  const result = await opts.sendEmail({
    from: opts.fromAddress ?? resolveFromAddress(opts.appUrl, "billing"),
    to: opts.recipientEmail,
    subject,
    html,
    text: plainText
  });

  if (result.error) {
    throw new Error(`Payment confirmation email failed: ${result.error.message ?? "unknown"}`);
  }

  return { providerId: result.data?.id ?? null };
}

/**
 * Buyers must provide a Polish NIP at checkout, so unlike the auth emails
 * (which default to EN) a missing profile row defaults to PL here.
 */
async function lookupLocale(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<"pl" | "en"> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", userId)
    .maybeSingle();
  return profile?.locale === "en" ? "en" : "pl";
}
