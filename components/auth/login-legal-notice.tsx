import Link from "next/link";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface LoginLegalNoticeProps {
  locale: MarketingLocale;
}

/**
 * Acceptance notice shown under the login form: registering (first sign-in)
 * means accepting the Regulamin and Polityka Prywatności. Required so the
 * terms are presented before the contract is concluded (art. 8 uśude).
 */
export function LoginLegalNotice({ locale }: LoginLegalNoticeProps) {
  const t = marketingCopy[locale].login.legalNotice;
  const termsHref = locale === "pl" ? "/terms" : "/en/terms";
  const privacyHref = locale === "pl" ? "/privacy" : "/en/privacy";

  return (
    <p className="text-center text-small text-text-muted">
      {t.prefix}{" "}
      <Link href={termsHref} className="underline underline-offset-2 hover:text-text-strong">
        {t.termsLabel}
      </Link>{" "}
      {t.conjunction}{" "}
      <Link href={privacyHref} className="underline underline-offset-2 hover:text-text-strong">
        {t.privacyLabel}
      </Link>
      .
    </p>
  );
}
