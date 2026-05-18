import { CheckCircle2 } from "lucide-react";
import { CreditSlider } from "@/components/billing/credit-slider";
import { PurchaseHistory } from "@/components/billing/purchase-history";
import { BillingStatusToast } from "@/components/billing/billing-status-toast";
import { CreditBalanceBand } from "@/components/billing/credit-balance-band";
import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getCurrentBalance } from "@/lib/billing/get-current-balance";
import { copy } from "@/lib/workspace/copy";

function nextFreeRefreshDate(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toISOString().slice(0, 10);
}

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const balance = await getCurrentBalance(user.id);
  const t = copy[uiLanguage];

  const params = await searchParams;
  const status = params.status === "paid" || params.status === "cancelled" ? params.status : undefined;

  const includedItems =
    uiLanguage === "pl"
      ? [
          "Tłumaczenie treści faktury (towary, usługi, opisy)",
          "MF-compliant PDF (schemat FA(3) 2025-06-25)",
          "QR code KSeF zachowany",
          "Opcja dwujęzyczna (PL + język docelowy)"
        ]
      : [
          "Translation of invoice content (items, services, descriptions)",
          "MF-compliant PDF (FA(3) 2025-06-25 schema)",
          "KSeF QR code preserved",
          "Bilingual option (PL + target language)"
        ];

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-h1 text-text-strong">{String(t.billingTitle)}</h1>
        <p className="mt-2 max-w-2xl text-body text-text-muted">{String(t.billingSubtitle)}</p>
      </div>

      <CreditBalanceBand
        paidCredits={balance.paidCredits}
        freeCreditsRemaining={balance.freeCreditsRemaining}
        nextFreeAt={nextFreeRefreshDate()}
        labels={{
          paidLabel: String(t.billingBandPaidLabel),
          freeLabel: String(t.billingBandFreeLabel),
          nextFreeLabel: String(t.billingBandNextFreeLabel)
        }}
      />

      <CreditSlider
        pickPackageLabel={String(t.pickPackage)}
        unitPriceLabel={String(t.unitPrice)}
        totalLabel={String(t.total)}
        totalWithTaxLabel={String(t.totalWithTax)}
        continueLabel={String(t.continueToCheckout)}
      />

      <div>
        <h2 className="text-h2 text-text-strong">{String(t.billingIncludedHeading)}</h2>
        <ul className="mt-4 space-y-3">
          {includedItems.map((item) => (
            <li key={item} className="flex items-start gap-3 text-body text-text">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {status ? (
        <BillingStatusToast
          status={status}
          successTitle={String(t.paymentSuccessTitle)}
          successBody={String(t.paymentSuccessBody)}
          cancelledTitle={String(t.paymentCancelledTitle)}
          cancelledBody={String(t.paymentCancelledBody)}
        />
      ) : null}

      <PurchaseHistory userId={user.id} uiLanguage={uiLanguage} />

      <div className="space-y-1 text-micro text-text-muted">
        <p>{String(t.billingVatNote)}</p>
        <p>{String(t.billingRefundPolicy)}</p>
      </div>
    </section>
  );
}
