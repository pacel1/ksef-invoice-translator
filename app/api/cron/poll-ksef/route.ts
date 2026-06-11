import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { constantTimeEqual } from "@/lib/security/constant-time-equal";
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
// A faktura that the pending pass — or the webhook's inline issue — finalized
// to 'processing' moments ago is certainly still 'processing' in KSeF. Polling
// it again in the same cycle burns one of the MAX_ATTEMPTS retries for nothing.
// Skip rows younger than this so the retry budget is spent on real status
// transitions; 30s clears the same-invocation race yet stays far under the
// 5-minute cron cadence.
const JUST_ISSUED_GRACE_MS = 30_000;
// A row a worker flipped to 'processing' as its issuance claim but that still has
// no provider_invoice_id has not minted anything yet. If it stays that way past
// this window the claiming worker crashed mid-issue, so it is safe to recover it
// back to 'failed' for re-issue. The window must comfortably exceed one issue
// round-trip so we never recover a row another worker is actively minting.
const STRANDED_CLAIM_RECOVERY_MS = 5 * 60_000;

interface ProcessedItem {
  ksef_invoice_id: string;
  action: "issued" | "polled" | "korekta_issued" | "skipped" | "failed";
  gov_status?: string;
  error?: string;
}

/**
 * Atomically claim a row for issuance. Flips pending/failed -> processing only
 * while provider_invoice_id is still null, returning whether THIS worker won.
 * Two overlapping cron runs both select the same pending row, but Postgres
 * serialises these guarded updates: the first transitions the row out of
 * pending/failed and the second's WHERE no longer matches, so exactly one
 * worker proceeds to mint the legal document. The attempt is counted here so a
 * poison row that crashes before minting still exhausts its retry budget.
 */
async function claimRowForIssue(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  rowId: string,
  nextAttempt: number
): Promise<boolean> {
  const claim = await admin
    .from("ksef_invoices")
    .update({ gov_status: "processing", attempt_count: nextAttempt })
    .eq("id", rowId)
    .in("gov_status", ["pending", "failed"])
    .is("provider_invoice_id", null)
    .select("id")
    .maybeSingle();
  return Boolean(claim.data);
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
  if (!constantTimeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Production cutover gate.
  if (process.env.KSEF_LIVE !== "true") {
    return NextResponse.json({ skipped: true, reason: "KSEF_LIVE != true" });
  }

  const admin = getSupabaseAdminClient();
  const processed: ProcessedItem[] = [];

  // 0. Recover stranded claims. A previous run may have claimed a row
  //    (pending/failed -> processing) and then crashed before it ever minted a
  //    document, leaving it 'processing' with a null provider_invoice_id. Flip
  //    those back to 'failed' so the pending pass re-claims them. The stale
  //    window guarantees we never disturb a row another worker is mid-issue on.
  const recoverBefore = new Date(Date.now() - STRANDED_CLAIM_RECOVERY_MS).toISOString();
  await admin
    .from("ksef_invoices")
    .update({ gov_status: "failed", last_error: "recovered: issuance claim did not complete" })
    .eq("gov_status", "processing")
    .is("provider_invoice_id", null)
    .lt("attempt_count", MAX_ATTEMPTS)
    .lt("updated_at", recoverBefore);

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
          // Atomically claim before minting so two overlapping cron runs can't
          // both issue this faktura (a duplicate legal document at KSeF).
          const won = await claimRowForIssue(admin, row.id, row.attempt_count + 1);
          if (!won) {
            processed.push({
              ksef_invoice_id: row.id,
              action: "skipped",
              error: "claimed by another worker"
            });
            continue;
          }
          const body = buildIfirmaFaktura(purchase);
          const created = await issueFaktura(body);
          providerInvoiceId = created.providerInvoiceId;
          await admin
            .from("ksef_invoices")
            .update({ provider_invoice_id: providerInvoiceId })
            .eq("id", row.id);
        }

        // Step 2: send to KSeF.
        await sendToKsef(providerInvoiceId, { korekta: false });
        await admin
          .from("ksef_invoices")
          .update({
            gov_status: "processing",
            last_error: null
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

      // Mint the korekta only if we haven't already (resume after a crash
      // between create and send-to-KSeF), and claim it atomically first so two
      // overlapping runs can't both issue it (a duplicate correction at KSeF).
      let korektaProviderId = row.provider_invoice_id as string | null;
      if (!korektaProviderId) {
        const wonKorekta = await claimRowForIssue(admin, row.id, row.attempt_count + 1);
        if (!wonKorekta) {
          processed.push({
            ksef_invoice_id: row.id,
            action: "skipped",
            error: "claimed by another worker"
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
        korektaProviderId = korekta.providerInvoiceId;
        await admin
          .from("ksef_invoices")
          .update({ provider_invoice_id: korektaProviderId })
          .eq("id", row.id);
      }
      await sendToKsef(korektaProviderId, { korekta: true });
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
    .lt(
      "created_at",
      new Date(Date.now() - JUST_ISSUED_GRACE_MS).toISOString()
    )
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
