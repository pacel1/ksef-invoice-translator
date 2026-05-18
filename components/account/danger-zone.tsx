"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  DeleteAccountModal,
  type DeleteAccountModalLabels
} from "@/components/account/delete-account-modal";

export interface DangerZoneLabels {
  heading: string;
  deleteTitle: string;
  deleteBody: string;
  deleteButton: string;
  modal: DeleteAccountModalLabels;
}

export interface DangerZoneProps {
  email: string;
  labels: DangerZoneLabels;
}

export function DangerZone({ email, labels }: DangerZoneProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section className="rounded-xl border border-danger/30 bg-surface p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
        <div className="flex-1">
          <h2 className="text-h2 text-danger">{labels.heading}</h2>
        </div>
      </div>
      <div className="mt-6 rounded-lg border border-border bg-surface-muted p-4">
        <p className="text-body font-medium text-text-strong">{labels.deleteTitle}</p>
        <p className="mt-1 text-small text-text-muted">{labels.deleteBody}</p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-danger bg-surface px-5 text-small font-semibold text-danger hover:bg-danger hover:text-white"
        >
          {labels.deleteButton}
        </button>
      </div>
      <DeleteAccountModal
        open={modalOpen}
        email={email}
        onClose={() => setModalOpen(false)}
        labels={labels.modal}
      />
    </section>
  );
}
