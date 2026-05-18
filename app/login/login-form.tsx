"use client";

import { useState, type FormEvent } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface LoginFormCopy {
  emailLabel: string;
  emailPlaceholder: string;
  submitButton: string;
  sendingButton: string;
  sentTitle: string;
  sentBodyPrefix: string;
  sentResend: string;
  errorGeneric: string;
  errorRateLimited: string;
}

export interface LoginFormProps {
  copy: LoginFormCopy;
}

type Status = "idle" | "submitting" | "sent" | "error" | "rate-limited";

export function LoginForm({ copy }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function submit(currentEmail: string) {
    setStatus("submitting");
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email: currentEmail,
      options: { emailRedirectTo: redirectTo }
    });
    if (error) {
      setStatus(error.status === 429 ? "rate-limited" : "error");
      return;
    }
    setStatus("sent");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit(email);
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-border bg-surface-muted p-6 text-center text-small text-text-strong shadow-sm">
        <MailCheck className="mx-auto mb-3 h-6 w-6 text-success" />
        <p className="text-h3 text-text-strong">{copy.sentTitle}</p>
        <p className="mt-2 text-text">
          {copy.sentBodyPrefix} <strong className="text-text-strong">{email}</strong>
        </p>
        <button
          type="button"
          onClick={() => submit(email)}
          className="mt-4 text-small font-medium text-accent hover:text-accent-hover"
        >
          {copy.sentResend}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-small">
        <span className="font-medium text-text">{copy.emailLabel}</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={copy.emailPlaceholder}
          autoComplete="email"
          className="h-11 rounded-md border border-border bg-surface px-4 text-body text-text-strong outline-none transition-colors duration-hover ease-out focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </label>
      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 text-small font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {copy.sendingButton}
          </>
        ) : (
          copy.submitButton
        )}
      </button>
      {status === "error" ? (
        <p className="text-small text-danger">{copy.errorGeneric}</p>
      ) : null}
      {status === "rate-limited" ? (
        <p className="text-small text-danger">{copy.errorRateLimited}</p>
      ) : null}
    </form>
  );
}
