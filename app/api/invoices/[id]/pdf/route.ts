import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFakturaPdf } from "@/lib/billing/ifirma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // RLS on ksef_invoices restricts SELECT to rows whose parent stripe_purchase
  // belongs to the caller, so a returned row implies ownership.
  const row = await supabase
    .from("ksef_invoices")
    .select("id, provider_invoice_id")
    .eq("id", id)
    .maybeSingle();

  if (!row.data || !row.data.provider_invoice_id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  try {
    const pdf = await getFakturaPdf(row.data.provider_invoice_id);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="faktura-${row.data.provider_invoice_id}.pdf"`,
        "Cache-Control": "private, max-age=300"
      }
    });
  } catch (error) {
    console.error(`[api/invoices/${id}/pdf] iFirma PDF fetch failed:`, error);
    return NextResponse.json({ error: "PDF unavailable" }, { status: 502 });
  }
}
