"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export interface DeleteAccountModalLabels {
  title: string;
  body: string;
  placeholder: string;
  confirmAction: string;
  cancel: string;
}

export interface DeleteAccountModalProps {
  open: boolean;
  email: string;
  onClose: () => void;
  labels: DeleteAccountModalLabels;
}

export function DeleteAccountModal({ open, email, onClose, labels }: DeleteAccountModalProps) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch("/api/me/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: typed })
      });
      if (res.ok) {
        window.location.assign("/");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text-strong/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-danger/30 bg-surface p-6 shadow-lg">
        <h2 id="delete-account-title" className="text-h3 text-text-strong">
          {labels.title}
        </h2>
        <p className="mt-2 text-small text-text">{labels.body}</p>
        <input
          type="email"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={labels.placeholder}
          className="mt-4 h-11 w-full rounded-md border border-border bg-surface px-4 text-body text-text-strong outline-none focus:border-danger focus:ring-2 focus:ring-danger/20"
        />
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-small font-medium text-text hover:bg-surface-muted"
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!matches || busy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-danger px-4 text-small font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {labels.confirmAction}
          </button>
        </div>
      </div>
    </div>
  );
}
