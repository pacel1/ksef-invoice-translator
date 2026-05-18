import { redirect } from "next/navigation";
import Link from "next/link";
import { getOptionalUser } from "@/lib/auth/require-user";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { LegalFooter } from "@/components/layout/legal-footer";
import { LoginForm } from "@/app/login/login-form";
import { marketingCopy } from "@/lib/marketing/copy";

export default async function EnLoginPage() {
  const user = await getOptionalUser();
  if (user) redirect("/app");

  const t = marketingCopy.en.login;

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted text-text-strong">
      <main className="flex flex-1 items-center justify-center px-5 py-12 md:px-8">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
          <div className="flex justify-center">
            <BrandLockup href="/en" size="lg" />
          </div>
          <h1 className="mt-8 text-h2 text-text-strong">{t.title}</h1>
          <p className="mt-1 text-small text-text-muted">{t.subtitle}</p>
          <div className="mt-6">
            <LoginForm copy={t} />
          </div>
          <p className="mt-6 text-center text-small text-text-muted">{t.noAccountHint}</p>
        </div>
      </main>
      <LegalFooter locale="en" />
      <div className="border-t border-border bg-surface py-4 text-center">
        <Link href="/en" className="text-small text-text-muted hover:text-text-strong">
          {t.backToHome}
        </Link>
      </div>
    </div>
  );
}
