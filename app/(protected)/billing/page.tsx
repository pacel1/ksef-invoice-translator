import { CreditSlider } from "@/components/billing/credit-slider";
import { PurchaseHistory } from "@/components/billing/purchase-history";
import { BillingStatusToast } from "@/components/billing/billing-status-toast";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { copy, type UiLanguage } from "@/lib/workspace/copy";

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();
  const uiLanguage: UiLanguage = profile?.locale === "en" ? "en" : "pl";
  const t = copy[uiLanguage];

  const params = await searchParams;
  const status = params.status === "paid" || params.status === "cancelled" ? params.status : undefined;

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{String(t.billingTitle)}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">{String(t.billingSubtitle)}</p>
      </div>

      <CreditSlider
        pickPackageLabel={String(t.pickPackage)}
        unitPriceLabel={String(t.unitPrice)}
        totalLabel={String(t.total)}
        totalWithTaxLabel={String(t.totalWithTax)}
        continueLabel={String(t.continueToCheckout)}
      />

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
    </section>
  );
}
