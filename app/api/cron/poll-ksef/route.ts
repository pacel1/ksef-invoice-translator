import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildIfirmaFaktura } from "@/lib/billing/build-ifirma-faktura";
import {
  issueFaktura,
  sendToKsef,
  issueKorekta,
  getKsefStatus
} from "@/lib/billing/ifirma";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel default; cap the worker loop accordingly.

const BATCH_SIZE = 20; // rows per invocation; keeps wall time < 60s
const MAX_ATTEMPTS = 5;

interface ProcessedItem {
  ksef_invoice_id: string;
  action: "issued" | "polled" | "korekta_issued" | "skipped" | "failed";
  gov_status?: string;
  error?: string;
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
    .from("ksef_invoices")
    .select(
      "id, stripe_purchase_id, kind, parent_id, provider_invoice_id, attempt_count, stripe_purchases(id, package_size, unit_price_cents, total_amount_cents, currency, buyer_nip, buyer_business_name, buyer_email, buyer_address_line1, buyer_address_line2, buyer_postal_code, buyer_city, buyer_country, created_at)"
    )
    .in("gov_status", ["pending", "failed"])
    .lt("attempt_count", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  for (const row of pending.data ?? []) {
    const purchase = row.stripe_purchases;
    if (!purchase) {
      processed.push({
        ksef_invoice_id: row.id,
        action: "skipped",
        error: "missing parent stripe_purchase"
      });
      continue;
    }

    try {
      if (row.kind === "vat") {
        let providerInvoiceId = row.provider_invoice_id as string | null;

        // Step 1: create the invoice only if we haven't already. This is the
        // idempotency guard: if the webhook (or a previous cron pass) crashed
        // between create and send-to-KSeF, we resume here without duplicating
        // the create call.
        if (!providerInvoiceId) {
          const body = buildIfirmaFaktura(purchase);
          const created = await issueFaktura(body);
          providerInvoiceId = created.providerInvoiceId;
          await admin
            .from("ksef_invoices")
            .update({
              provider_invoice_id: providerInvoiceId,
              attempt_count: row.attempt_count + 1
            })
            .eq("id", row.id);
        }

        // Step 2: send to KSeF.
        await sendToKsef(providerInvoiceId, { korekta: false });
        await admin
          .from("ksef_invoices")
          .update({
            gov_status: "processing",
            last_error: null,
            attempt_count: row.attempt_count + 1
          })
          .eq("id", row.id);

        processed.push({
          ksef_invoice_id: row.id,
          action: "issued",
          gov_status: "processing"
        });
        continue;
      }

      // kind === "correction"
      if (!row.parent_id) {
        processed.push({
          ksef_invoice_id: row.id,
          action: "skipped",
          error: "korekta without parent_id"
        });
        continue;
      }

      const parent = await admin
        .from("ksef_invoices")
        .select("provider_invoice_id, gov_status, gov_id")
        .eq("id", row.parent_id)
        .single();

      if (parent.error || !parent.data) {
        processed.push({
          ksef_invoice_id: row.id,
          action: "skipped",
          error: "parent missing"
        });
        continue;
      }

      // Wait for parent KSeF acceptance before issuing the korekta.
      if (parent.data.gov_status !== "ok" || !parent.data.provider_invoice_id) {
        processed.push({
          ksef_invoice_id: row.id,
          action: "skipped",
          error: "parent not yet KSeF-accepted"
        });
        continue;
      }

      const built = buildIfirmaFaktura(purchase);
      const korekta = await issueKorekta({
        originalProviderInvoiceId: parent.data.provider_invoice_id,
        reason: "ZWR_SPRZ_TOW",
        issueDate: new Date().toISOString().slice(0, 10),
        sposobZaplaty: "KOM",
        zaplacono: 0,
        // Full refund: corrected quantity 0 (everything returned). iFirma
        // computes the delta from the original. Verify partial-refund
        // semantics with live creds.
        positions: built.Pozycje.map((p) => ({ ...p, Ilosc: 0 }))
      });
      await admin
        .from("ksef_invoices")
        .update({
          provider_invoice_id: korekta.providerInvoiceId,
          attempt_count: row.attempt_count + 1
        })
        .eq("id", row.id);
      await sendToKsef(korekta.providerInvoiceId, { korekta: true });
      await admin
        .from("ksef_invoices")
        .update({ gov_status: "processing", last_error: null })
        .eq("id", row.id);
      processed.push({
        ksef_invoice_id: row.id,
        action: "korekta_issued",
        gov_status: "processing"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[cron/poll-ksef] failed to process row ${row.id}:`,
        message
      );
      await admin
        .from("ksef_invoices")
        .update({
          gov_status: "failed",
          last_error: message,
          attempt_count: row.attempt_count + 1
        })
        .eq("id", row.id);
      processed.push({
        ksef_invoice_id: row.id,
        action: "failed",
        error: message
      });
    }
  }

  // 2. PROCESSING rows — poll iFirma/KSeF for the terminal state.
  const processing = await admin
    .from("ksef_invoices")
    .select("id, provider_invoice_id, attempt_count")
    .eq("gov_status", "processing")
    .not("provider_invoice_id", "is", null)
    .lt("attempt_count", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  for (const row of processing.data ?? []) {
    if (!row.provider_invoice_id) continue;
    try {
      const result = await getKsefStatus(row.provider_invoice_id);
      await admin
        .from("ksef_invoices")
        .update({
          gov_status: result.govStatus,
          gov_id: result.govId,
          last_error: result.errorMessages.join("; ") || null,
          attempt_count: row.attempt_count + 1
        })
        .eq("id", row.id);
      processed.push({
        ksef_invoice_id: row.id,
        action: "polled",
        gov_status: result.govStatus
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await admin
        .from("ksef_invoices")
        .update({
          last_error: message,
          attempt_count: row.attempt_count + 1
        })
        .eq("id", row.id);
      processed.push({
        ksef_invoice_id: row.id,
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
