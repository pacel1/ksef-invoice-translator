import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UiLanguage } from "@/lib/workspace/copy";
import { copy } from "@/lib/workspace/copy";

interface PurchaseHistoryProps {
  userId: string;
  uiLanguage: UiLanguage;
}

export async function PurchaseHistory({ userId, uiLanguage }: PurchaseHistoryProps) {
  const admin = getSupabaseAdminClient();
  const { data: rows } = await admin
    .from("stripe_purchases")
    .select("id, package_size, total_amount_cents, currency, status, created_at, paid_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const t = copy[uiLanguage];
  const formatter = new Intl.NumberFormat(uiLanguage === "pl" ? "pl-PL" : "en-GB", {
    style: "currency",
    currency: "PLN"
  });
  const dateFormatter = new Intl.DateTimeFormat(uiLanguage === "pl" ? "pl-PL" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  function statusLabel(status: string): string {
    switch (status) {
      case "paid":
        return String(t.purchaseStatusPaid);
      case "pending":
        return String(t.purchaseStatusPending);
      case "failed":
        return String(t.purchaseStatusFailed);
      case "refunded":
        return String(t.purchaseStatusRefunded);
      default:
        return status;
    }
  }

  if (!rows || rows.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-950">{String(t.purchaseHistory)}</h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">{String(t.purchaseDate)}</th>
              <th className="px-4 py-3">{String(t.purchaseSize)}</th>
              <th className="px-4 py-3">{String(t.purchaseTotal)}</th>
              <th className="px-4 py-3">{String(t.purchaseStatus)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-700">
                  {dateFormatter.format(new Date(row.created_at))}
                </td>
                <td className="px-4 py-3 text-slate-700">{row.package_size}</td>
                <td className="px-4 py-3 text-slate-700">
                  {formatter.format(row.total_amount_cents / 100)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function statusClass(status: string): string {
  switch (status) {
    case "paid":
      return "bg-emerald-50 text-emerald-800 border border-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    case "refunded":
      return "bg-slate-100 text-slate-700 border border-slate-200";
    case "failed":
      return "bg-rose-50 text-rose-800 border border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
  }
}
