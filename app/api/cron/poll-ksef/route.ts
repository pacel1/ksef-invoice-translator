import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildFakturaParams } from "@/lib/billing/build-faktura-params";
import {
  issueFaktura,
  issueKorekta,
  getFakturaStatus
} from "@/lib/billing/fakturownia";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel default; cap the worker loop accordingly.

const BATCH_SIZE = 20; // rows per invocation; keeps wall time < 60s
const MAX_ATTEMPTS = 5;

interface ProcessedItem {
  fakturownia_invoice_id: string;
  action: "issued" | "polled" | "korekta_issued" | "skipped" | "failed";
  gov_status?: string;
  error?: string;
}

/**
 * Map Fakturownia's KSeF status onto the narrower set our DB CHECK
 * constraint allows. Fakturownia distinguishes `send_error` (KSeF rejected
 * the document) from `server_error` (network/Fakturownia upstream blew up);
 * we collapse the latter into `failed` since our state machine treats it as
 * a retry candidate, not a terminal rejection.
 */
function mapFakturowniaToDbStatus(
  govStatus: string
): "processing" | "ok" | "send_error" | "failed" {
  if (govStatus === "server_error") return "failed";
  return govStatus as "processing" | "ok" | "send_error" | "failed";
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Production cutover gate.
  if (process.env.KSEF_LIVE !== "true") {
    return NextResponse.json({ skipped: true, reason: "KSEF_LIVE != true" });
  }

  const admin = getSupabaseAdminClient();
  const processed: ProcessedItem[] = [];

  // 1. PENDING rows — try to issue them.
  const pending = await admin
    .from("fakturownia_invoices")
    .select(
      "id, stripe_purchase_id, kind, parent_id, attempt_count, stripe_purchases(id, package_size, unit_price_cents, total_amount_cents, currency, buyer_nip, buyer_business_name, buyer_email, buyer_address_line1, buyer_address_line2, buyer_postal_code, buyer_city, buyer_country, created_at)"
    )
    .in("gov_status", ["pending", "failed"])
    .lt("attempt_count", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  for (const row of pending.data ?? []) {
    const purchase = row.stripe_purchases;
    if (!purchase) {
      processed.push({
        fakturownia_invoice_id: row.id,
        action: "skipped",
        error: "missing parent stripe_purchase"
      });
      continue;
    }

    try {
      if (row.kind === "vat") {
        const params = buildFakturaParams(purchase);
        const result = await issueFaktura(params);
        await admin
          .from("fakturownia_invoices")
          .update({
            fakturownia_id: result.fakturowniaId,
            gov_status: mapFakturowniaToDbStatus(result.govStatus),
            gov_id: result.govId,
            pdf_url: result.pdfUrl,
            last_error: result.errorMessages.join("; ") || null,
            attempt_count: row.attempt_count + 1
          })
          .eq("id", row.id);
        processed.push({
          fakturownia_invoice_id: row.id,
          action: "issued",
          gov_status: result.govStatus
        });
        continue;
      }

      // kind === "correction"
      if (!row.parent_id) {
        processed.push({
          fakturownia_invoice_id: row.id,
          action: "skipped",
          error: "korekta without parent_id"
        });
        continue;
      }

      const parent = await admin
        .from("fakturownia_invoices")
        .select("fakturownia_id, gov_status, gov_id")
        .eq("id", row.parent_id)
        .single();

      if (parent.error || !parent.data) {
        processed.push({
          fakturownia_invoice_id: row.id,
          action: "skipped",
          error: "parent missing"
        });
        continue;
      }

      // Wait for parent KSeF acceptance before issuing the korekta.
      if (parent.data.gov_status !== "ok" || !parent.data.fakturownia_id) {
        processed.push({
          fakturownia_invoice_id: row.id,
          action: "skipped",
          error: "parent not yet KSeF-accepted"
        });
        continue;
      }

      const params = buildFakturaParams(purchase);
      const result = await issueKorekta({
        originalFakturowniaId: parent.data.fakturownia_id,
        stripePurchaseId: purchase.id,
        issueDate: new Date().toISOString().slice(0, 10),
        reason: "Zwrot kredytów - anulowanie zakupu",
        positions: params.positions.map((p) => ({
          ...p,
          // Negate the net price to express a refund.
          priceNet: `-${p.priceNet}`
        })),
        currency: params.currency
      });

      await admin
        .from("fakturownia_invoices")
        .update({
          fakturownia_id: result.fakturowniaId,
          gov_status: mapFakturowniaToDbStatus(result.govStatus),
          gov_id: result.govId,
          pdf_url: result.pdfUrl,
          last_error: result.errorMessages.join("; ") || null,
          attempt_count: row.attempt_count + 1
        })
        .eq("id", row.id);
      processed.push({
        fakturownia_invoice_id: row.id,
        action: "korekta_issued",
        gov_status: result.govStatus
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[cron/poll-ksef] failed to process row ${row.id}:`,
        message
      );
      await admin
        .from("fakturownia_invoices")
        .update({
          gov_status: "failed",
          last_error: message,
          attempt_count: row.attempt_count + 1
        })
        .eq("id", row.id);
      processed.push({
        fakturownia_invoice_id: row.id,
        action: "failed",
        error: message
      });
    }
  }

  // 2. PROCESSING rows — poll Fakturownia for the terminal state.
  const processing = await admin
    .from("fakturownia_invoices")
    .select("id, fakturownia_id, attempt_count")
    .eq("gov_status", "processing")
    .not("fakturownia_id", "is", null)
    .lt("attempt_count", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  for (const row of processing.data ?? []) {
    if (!row.fakturownia_id) continue;
    try {
      const result = await getFakturaStatus(row.fakturownia_id);
      await admin
        .from("fakturownia_invoices")
        .update({
          gov_status: mapFakturowniaToDbStatus(result.govStatus),
          gov_id: result.govId,
          last_error: result.errorMessages.join("; ") || null,
          attempt_count: row.attempt_count + 1
        })
        .eq("id", row.id);
      processed.push({
        fakturownia_invoice_id: row.id,
        action: "polled",
        gov_status: result.govStatus
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await admin
        .from("fakturownia_invoices")
        .update({
          last_error: message,
          attempt_count: row.attempt_count + 1
        })
        .eq("id", row.id);
      processed.push({
        fakturownia_invoice_id: row.id,
        action: "failed",
        error: message
      });
    }
  }

  return NextResponse.json({ processed });
}

export async function GET(request: Request): Promise<NextResponse> {
  // Vercel Cron sends GET by default. Auth header is what we check, so either
  // verb works. Mirror to POST for symmetry.
  return POST(request);
}
