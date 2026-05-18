import { BrandLockup } from "@/components/brand/brand-lockup";
import { LegalFooter } from "@/components/layout/legal-footer";
import { AuthErrorView } from "@/components/marketing/auth-error-view";
import { marketingCopy } from "@/lib/marketing/copy";

export default async function AuthErrorPage({
  searchParams
}: {
  searchParams: Promise<{ reason?: string; error_id?: string }>;
}) {
  const params = await searchParams;
  const reason = params.reason ?? "generic";
  const errorId = params.error_id;

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted text-text-strong">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-3 md:px-8">
          <BrandLockup href="/" size="md" />
        </div>
      </header>
      <AuthErrorView copy={marketingCopy.pl.authError} reason={reason} errorId={errorId} />
      <LegalFooter />
    </div>
  );
}
