import { render } from "@react-email/render";
import { decode } from "entities";
import { PaymentConfirmationEmail } from "./payment-confirmation";
import type { EmailLocale } from "./render-template";

export interface RenderPaymentConfirmationOptions {
  locale: EmailLocale | string;
  packageSize: number;
  /** Gross amount actually charged, in minor units (grosze). */
  amountPaidCents: number;
  /** ISO currency code, case-insensitive, e.g. "pln". */
  currency: string;
  recipientEmail: string;
}

export interface RenderedPaymentConfirmationEmail {
  subject: string;
  html: string;
  plainText: string;
}

const SUBJECTS: Record<EmailLocale, string> = {
  pl: "Płatność potwierdzona, faktura trafi do KSeF",
  en: "Payment confirmed, your invoice is coming via KSeF"
};

function normalizeLocale(locale: string): EmailLocale {
  return locale === "pl" ? "pl" : "en";
}

function formatAmount(cents: number, currency: string, locale: EmailLocale): string {
  return new Intl.NumberFormat(locale === "pl" ? "pl-PL" : "en-GB", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(cents / 100);
}

export async function renderPaymentConfirmationEmail(
  opts: RenderPaymentConfirmationOptions
): Promise<RenderedPaymentConfirmationEmail> {
  if (!Number.isInteger(opts.packageSize) || opts.packageSize <= 0) {
    throw new Error(`Invalid package size: ${String(opts.packageSize)}`);
  }
  if (!Number.isInteger(opts.amountPaidCents) || opts.amountPaidCents < 0) {
    throw new Error(`Invalid amount: ${String(opts.amountPaidCents)}`);
  }

  const locale = normalizeLocale(opts.locale);
  const subject = SUBJECTS[locale];

  const element = PaymentConfirmationEmail({
    locale,
    packageSize: opts.packageSize,
    amountPaid: formatAmount(opts.amountPaidCents, opts.currency, locale),
    recipientEmail: opts.recipientEmail
  });

  const [rawHtml, plainText] = await Promise.all([
    render(element),
    render(element, { plainText: true })
  ]);

  return { subject, html: decode(rawHtml), plainText };
}
