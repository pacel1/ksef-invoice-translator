"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export interface DataExportLabels {
  heading: string;
  body: string;
  button: string;
  preparing: string;
}

export interface DataExportSectionProps {
  labels: DataExportLabels;
}

export function DataExportSection({ labels }: DataExportSectionProps) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const res = await fetch("/api/me/export", { method: "POST" });
      if (!res.ok) {
        console.warn("[export] non-OK response", res.status);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tlumaczksef-export-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-h2 text-text-strong">{labels.heading}</h2>
      <p className="mt-2 text-body text-text-muted">{labels.body}</p>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? labels.preparing : labels.button}
      </button>
    </section>
  );
}
