import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export interface AuthErrorCopy {
  title: string;
  reasonExpired: { heading: string; body: string; cta: string };
  reasonUsed: { heading: string; body: string; cta: string };
  reasonGeneric: { heading: string; body: string; cta: string };
  errorIdLabel: string;
}

export interface AuthErrorViewProps {
  copy: AuthErrorCopy;
  reason: string;
  errorId?: string;
}

function resolveReason(copy: AuthErrorCopy, reason: string) {
  if (reason === "expired") return copy.reasonExpired;
  if (reason === "used") return copy.reasonUsed;
  return copy.reasonGeneric;
}

export function AuthErrorView({ copy, reason, errorId }: AuthErrorViewProps) {
  const variant = resolveReason(copy, reason);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-5 py-16 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-text-muted">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="text-h1 text-text-strong">{variant.heading}</h1>
      <p className="text-body text-text-muted">{variant.body}</p>
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-md bg-accent px-5 py-3 text-small font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors duration-hover ease-out"
      >
        {variant.cta}
      </Link>
      {errorId ? (
        <p className="font-mono text-micro text-text-muted">
          {copy.errorIdLabel}: <span data-testid="auth-error-id">{errorId}</span>
        </p>
      ) : null}
    </main>
  );
}
