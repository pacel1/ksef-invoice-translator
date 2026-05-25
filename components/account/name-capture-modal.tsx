"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { updateProfile } from "@/app/actions/profile";

export interface NameCaptureModalLabels {
  title: string;
  /**
   * Multi-paragraph explanatory body. Pass `null` to omit. The reason
   * MF requires the name shows up here so the user understands why the
   * dialog is interrupting them.
   */
  body: string;
  firstNameLabel: string;
  lastNameLabel: string;
  saveButton: string;
  savingButton: string;
  /**
   * Text on the in-form "skip for now" button. Only shown when the
   * modal is dismissible. Pass undefined to hide that button (the X is
   * still rendered).
   */
  dismissButton?: string;
  /**
   * Accessible name for the small X icon button in the corner. Defaults
   * to "Close" so non-localised tests still find it.
   */
  closeAriaLabel?: string;
  errorMessage: string;
}

export interface NameCaptureModalProps {
  open: boolean;
  /** Allow closing without saving. Hard-block calls use `dismissible={false}`. */
  dismissible?: boolean;
  initialFirstName?: string | null;
  initialLastName?: string | null;
  labels: NameCaptureModalLabels;
  onClose: () => void;
  /** Fired AFTER updateProfile() returns ok — wrappers use this to retry the
   *  pending action (e.g. translate) once the name is on file. */
  onSaved?: () => void;
}

type Status = "idle" | "saving" | "error";

/**
 * Reusable name-capture dialog. Two flavours:
 *
 *   dismissible=true   → soft prompt (post-OTP welcome). User can close
 *                        with the X or dismiss button; modal stays
 *                        non-blocking.
 *   dismissible=false  → hard block. No close button, escape doesn't
 *                        close, must save to proceed. Used when the
 *                        user clicks Translate without a name on file.
 */
export function NameCaptureModal({
  open,
  dismissible = true,
  initialFirstName,
  initialLastName,
  labels,
  onClose,
  onSaved
}: NameCaptureModalProps) {
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus the first input every time the modal opens — keyboard-only
  // users shouldn't have to tab to the form.
  useEffect(() => {
    if (open) {
      setStatus("idle");
      firstInputRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const canSave =
    firstName.trim().length > 0 && lastName.trim().length > 0 && status !== "saving";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    setStatus("saving");
    const result = await updateProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim()
    });
    if (result.ok) {
      setStatus("idle");
      onSaved?.();
      onClose();
    } else {
      setStatus("error");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-capture-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text-strong/40 p-4"
      onKeyDown={(e) => {
        if (dismissible && e.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <h2
            id="name-capture-title"
            className="text-h3 text-text-strong"
          >
            {labels.title}
          </h2>
          {dismissible ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={labels.closeAriaLabel ?? "Close"}
              className="-mr-2 -mt-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text-strong"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {labels.body ? (
          <p className="mt-3 whitespace-pre-line text-small text-text-muted">
            {labels.body}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="flex flex-col gap-1.5 text-small">
            <span className="font-medium text-text">{labels.firstNameLabel}</span>
            <input
              ref={firstInputRef}
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="h-11 rounded-md border border-border bg-surface px-4 text-body text-text-strong outline-none transition-colors duration-hover focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-small">
            <span className="font-medium text-text">{labels.lastNameLabel}</span>
            <input
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="h-11 rounded-md border border-border bg-surface px-4 text-body text-text-strong outline-none transition-colors duration-hover focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </label>

          {status === "error" ? (
            <p className="text-small text-danger">{labels.errorMessage}</p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            {dismissible && labels.dismissButton ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-border bg-surface px-4 text-small font-medium text-text hover:bg-surface-muted"
              >
                {labels.dismissButton}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "saving" ? labels.savingButton : labels.saveButton}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
