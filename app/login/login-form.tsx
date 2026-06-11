"use client";

import { useState, type FormEvent } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { GoogleIcon } from "@/components/auth/google-icon";
import posthog from "posthog-js";

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
  googleButton: string;
  divider: string;
  googleError: string;
}

export interface LoginFormProps {
  copy: LoginFormCopy;
}

type Status = "idle" | "submitting" | "sent" | "error" | "rate-limited";

type GoogleStatus = "idle" | "pending" | "error";

export function LoginForm({ copy }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>("idle");

  async function signInWithGoogle() {
    posthog.capture("google_signin_clicked");
    setGoogleStatus("pending");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` }
      });
      if (error) {
        setGoogleStatus("error");
        posthog.captureException(error);
      }
      // On success the browser is being redirected to Google; stay pending.
    } catch (err) {
      setGoogleStatus("error");
      posthog.captureException(err);
    }
  }

  async function submit(currentEmail: string) {
    posthog.capture("login_submitted", { method: "email_otp" });
    setStatus("submitting");
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email: currentEmail,
        options: { emailRedirectTo: redirectTo }
      });
      if (error) {
        setStatus(error.status === 429 ? "rate-limited" : "error");
        posthog.captureException(error);
        return;
      }
      posthog.capture("login_email_sent", { method: "email_otp" });
      posthog.identify(currentEmail, { email: currentEmail });
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      posthog.captureException(err);
    }
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
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={googleStatus === "pending"}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-small font-semibold text-text-strong shadow-sm transition-colors duration-hover ease-out hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        {googleStatus === "pending" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        {copy.googleButton}
      </button>
      {googleStatus === "error" ? (
        <p role="alert" className="text-small text-danger">
          {copy.googleError}
        </p>
      ) : null}
      <div className="flex items-center gap-3 text-small text-text-muted">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        {copy.divider}
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
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
          <p role="alert" className="text-small text-danger">
            {copy.errorGeneric}
          </p>
        ) : null}
        {status === "rate-limited" ? (
          <p role="alert" className="text-small text-danger">
            {copy.errorRateLimited}
          </p>
        ) : null}
      </form>
    </div>
  );
}
