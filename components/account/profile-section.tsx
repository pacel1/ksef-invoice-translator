"use client";

import { useState, type FormEvent } from "react";
import { updateProfile } from "@/app/actions/profile";

export interface ProfileSectionLabels {
  heading: string;
  emailLabel: string;
  emailHelp: string;
  localeLabel: string;
  displayNameLabel: string;
  displayNameHelp: string;
  saveButton: string;
  savingButton: string;
  saveSuccess: string;
  saveError: string;
}

export interface ProfileSectionProps {
  email: string;
  initialLocale: "pl" | "en";
  initialDisplayName: string;
  labels: ProfileSectionLabels;
}

type Status = "idle" | "saving" | "saved" | "error";

export function ProfileSection({
  email,
  initialLocale,
  initialDisplayName,
  labels
}: ProfileSectionProps) {
  const [locale, setLocale] = useState<"pl" | "en">(initialLocale);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    const result = await updateProfile({ locale, displayName });
    setStatus(result.ok ? "saved" : "error");
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-h2 text-text-strong">{labels.heading}</h2>

      <div className="mt-6 space-y-5">
        <div>
          <span className="block text-small font-medium text-text">{labels.emailLabel}</span>
          <p className="mt-1 font-mono text-body text-text-strong">{email}</p>
          <p className="mt-1 text-micro text-text-muted">{labels.emailHelp}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <fieldset>
            <legend className="text-small font-medium text-text">{labels.localeLabel}</legend>
            <div className="mt-2 inline-flex rounded-md border border-border bg-surface">
              {(["pl", "en"] as const).map((value) => (
                <label
                  key={value}
                  className={`cursor-pointer px-4 py-2 text-small font-medium uppercase ${
                    locale === value ? "bg-accent text-white" : "text-text"
                  }`}
                >
                  <input
                    type="radio"
                    name="locale"
                    value={value}
                    checked={locale === value}
                    onChange={() => setLocale(value)}
                    className="sr-only"
                  />
                  {value}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1.5 text-small">
            <span className="font-medium text-text">{labels.displayNameLabel}</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-11 rounded-md border border-border bg-surface px-4 text-body text-text-strong outline-none transition-colors duration-hover ease-out focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
            <span className="text-micro text-text-muted">{labels.displayNameHelp}</span>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={status === "saving"}
              className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "saving" ? labels.savingButton : labels.saveButton}
            </button>
            {status === "saved" ? (
              <span className="text-small text-success">{labels.saveSuccess}</span>
            ) : null}
            {status === "error" ? (
              <span className="text-small text-danger">{labels.saveError}</span>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
