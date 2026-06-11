"use client";

import { useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import type { marketingCopy } from "@/lib/marketing/copy";

// Widened to plain strings so both locale variants of the `as const` copy
// object are assignable.
export type ContactFormCopy = Record<keyof (typeof marketingCopy)["pl"]["contact"], string>;

export interface ContactFormProps {
  copy: ContactFormCopy;
  contactEmail: string;
}

type Status = "idle" | "submitting" | "success" | "error" | "rate_limited";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 5000;

const fieldClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-body text-text-strong placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const labelClass = "text-small font-medium text-text-strong";

export function ContactForm({ copy, contactEmail }: ContactFormProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState(siteKey ? "" : "dev");
  const [status, setStatus] = useState<Status>("idle");
  const turnstileRef = useRef<TurnstileInstance>(null);

  function fail(next: "error" | "rate_limited") {
    setStatus(next);
    if (siteKey) {
      turnstileRef.current?.reset();
      setToken("");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!EMAIL_RE.test(email) || trimmed.length < MESSAGE_MIN || !token) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email,
          message: trimmed,
          turnstileToken: token
        })
      });
      if (res.status === 429) return fail("rate_limited");
      if (!res.ok) return fail("error");
      setStatus("success");
    } catch {
      fail("error");
    }
  }

  if (status === "success") {
    return (
      <p role="status" className="rounded-md border border-border bg-surface-muted p-4 text-body text-text-strong">
        {copy.success}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="contact-name">{copy.nameLabel}</label>
        <input
          id="contact-name"
          type="text"
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={copy.namePlaceholder}
          className={fieldClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="contact-email">{copy.emailLabel}</label>
        <input
          id="contact-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={copy.emailPlaceholder}
          className={fieldClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="contact-message">{copy.messageLabel}</label>
        <textarea
          id="contact-message"
          required
          minLength={MESSAGE_MIN}
          maxLength={MESSAGE_MAX}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={copy.messagePlaceholder}
          className={fieldClass}
        />
      </div>
      {siteKey ? (
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          onSuccess={setToken}
          onExpire={() => setToken("")}
          onError={() => setToken("")}
        />
      ) : null}
      <button
        type="submit"
        disabled={status === "submitting" || !token}
        aria-busy={status === "submitting"}
        className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2.5 text-body font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {status === "submitting" ? copy.sending : copy.submit}
      </button>
      {status === "error" || status === "rate_limited" ? (
        <p role="alert" className="text-small text-danger">
          {status === "rate_limited" ? copy.rateLimited : copy.error}{" "}
          <a href={`mailto:${contactEmail}`} className="font-medium underline">
            {contactEmail}
          </a>
        </p>
      ) : null}
    </form>
  );
}
