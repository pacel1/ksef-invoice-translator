import { render } from "@react-email/render";
import { decode } from "entities";
import { MagicLinkEmail } from "./magic-link";

export type SupabaseEmailActionType =
  | "signup"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "invite"
  | "email";

export type EmailLocale = "pl" | "en";

export interface RenderAuthEmailOptions {
  link: string;
  locale: EmailLocale | string;
  recipientEmail: string;
  actionType: SupabaseEmailActionType | string;
}

export interface RenderedAuthEmail {
  subject: string;
  html: string;
  plainText: string;
}

const SUBJECTS: Record<EmailLocale, Record<SupabaseEmailActionType, string>> = {
  pl: {
    signup: "Zaloguj się do KSeF Translator",
    magiclink: "Zaloguj się do KSeF Translator",
    recovery: "Zaloguj się do KSeF Translator",
    email_change: "Potwierdź zmianę adresu email",
    invite: "Zaproszenie do KSeF Translator",
    email: "Zaloguj się do KSeF Translator"
  },
  en: {
    signup: "Sign in to KSeF Translator",
    magiclink: "Sign in to KSeF Translator",
    recovery: "Sign in to KSeF Translator",
    email_change: "Confirm your new email address",
    invite: "You're invited to KSeF Translator",
    email: "Sign in to KSeF Translator"
  }
};

function normalizeLocale(locale: string): EmailLocale {
  return locale === "pl" ? "pl" : "en";
}

function normalizeActionType(actionType: string): SupabaseEmailActionType {
  const allowed: SupabaseEmailActionType[] = [
    "signup",
    "magiclink",
    "recovery",
    "email_change",
    "invite",
    "email"
  ];
  return (allowed.includes(actionType as SupabaseEmailActionType)
    ? actionType
    : "magiclink") as SupabaseEmailActionType;
}

export async function renderAuthEmail(opts: RenderAuthEmailOptions): Promise<RenderedAuthEmail> {
  const locale = normalizeLocale(opts.locale);
  const actionType = normalizeActionType(opts.actionType);

  const subject = SUBJECTS[locale][actionType];

  const element = MagicLinkEmail({
    link: opts.link,
    locale,
    recipientEmail: opts.recipientEmail
  });

  const [rawHtml, plainText] = await Promise.all([
    render(element),
    render(element, { plainText: true })
  ]);

  const html = decode(rawHtml);

  return { subject, html, plainText };
}
