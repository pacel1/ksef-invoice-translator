"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export interface BillingStatusToastProps {
  status: "paid" | "cancelled";
  successTitle: string;
  successBody: string;
  cancelledTitle: string;
  cancelledBody: string;
}

export function BillingStatusToast({
  status,
  successTitle,
  successBody,
  cancelledTitle,
  cancelledBody
}: BillingStatusToastProps) {
  useEffect(() => {
    if (status === "paid" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("credit-balance-changed"));
    }
  }, [status]);

  if (status === "paid") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{successTitle}</p>
          <p className="mt-1 text-emerald-800">{successBody}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900">
      <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{cancelledTitle}</p>
        <p className="mt-1 text-slate-700">{cancelledBody}</p>
      </div>
    </div>
  );
}
