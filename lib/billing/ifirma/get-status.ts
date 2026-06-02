import { ifirmaGet } from "./client";
import type { KsefInvoiceResult } from "./types";

/**
 * iFirma's `StatusKSEF` sub-object on a single invoice. Confirmed against the
 * live API (2026-06-02). `Status` is an enum string; `Opis` is a human-readable
 * description (carries the rejection reason on failure).
 */
interface IfirmaStatusKsef {
  Status?: string;
  Opis?: string;
  TrybWysylki?: string;
  CzasWysylki?: string;
  CzasWlasciwejWysylki?: string;
}

/**
 * Detects an iFirma KSeF status string that means the document was rejected
 * or errored at submission — a terminal failure, not a retry-and-wait.
 * iFirma's accepted status is `PRZYJETA_W_KSEF`; rejection/error variants use
 * `ODRZUCONA…` (rejected) or `BŁĄD…`/`BLAD…` (error). Matched case- and
 * accent-insensitively so spelling/encoding drift doesn't slip through.
 */
function isRejectionStatus(status: string): boolean {
  return /ODRZ|B[ŁL][ĄA]D|BLEDN|B[ŁL][ĘE]DN|NEGATYW|ERROR/i.test(status);
}

/**
 * Read the KSeF state of a single iFirma invoice. The single-invoice GET
 * returns the invoice object directly (no `{ response }` wrapper — unlike the
 * list/mutation endpoints); we handle both shapes. Field names confirmed
 * against the live API (2026-06-02):
 *
 *   - `NumerKSEF` — the KSeF reference number. KSeF assigns it ONLY on
 *     acceptance, so a non-empty value is the authoritative "accepted" signal.
 *   - `StatusKSEF.Status` — enum: `PRZYJETA_W_KSEF` (accepted),
 *     `ODRZUCONA…`/`BŁĄD…` (rejected/error), or an in-progress value.
 *   - `StatusKSEF.Opis` — human description; carries the rejection reason.
 *
 * Note: the list endpoint's `CzyWyslano` is NOT a reliable KSeF signal (it can
 * read false for an already-accepted invoice), which is why we poll the
 * single-invoice endpoint and read `StatusKSEF` instead.
 *
 * Maps to our DB state machine:
 *   accepted              → ok (+ govId = NumerKSEF)
 *   rejected / send error  → send_error (+ Opis as the error message)
 *   sent-and-waiting / etc → processing (keep polling; the cron caps attempts)
 */
export async function getKsefStatus(
  providerInvoiceId: string
): Promise<KsefInvoiceResult> {
  const body = await ifirmaGet<Record<string, unknown>>(
    `/fakturakraj/${encodeURIComponent(providerInvoiceId)}.json`
  );

  const inner =
    (body as { response?: Record<string, unknown> }).response ?? body;

  const numerKsef =
    typeof inner.NumerKSEF === "string" && inner.NumerKSEF.trim().length > 0
      ? inner.NumerKSEF.trim()
      : null;

  const statusObj = (inner.StatusKSEF ?? null) as IfirmaStatusKsef | null;
  const status = (statusObj?.Status ?? "").toUpperCase();
  const opis = statusObj?.Opis ?? "";

  console.info(
    "[ifirma/get-status] KSeF status for invoice",
    providerInvoiceId,
    JSON.stringify({ NumerKSEF: numerKsef, StatusKSEF: statusObj })
  );

  // Accepted: a KSeF number means the document is in KSeF, full stop. We also
  // accept an explicit PRZYJ* status as a belt-and-suspenders signal.
  if (numerKsef || status.includes("PRZYJ")) {
    return {
      providerInvoiceId,
      govStatus: "ok",
      govId: numerKsef,
      errorMessages: [],
      raw: body
    };
  }

  // Rejected / send error — surface the description so ops can see why.
  if (isRejectionStatus(status)) {
    return {
      providerInvoiceId,
      govStatus: "send_error",
      govId: null,
      errorMessages: opis ? [opis] : [status],
      raw: body
    };
  }

  // Sent-and-waiting, queued, or not yet dispatched — keep polling.
  return {
    providerInvoiceId,
    govStatus: "processing",
    govId: null,
    errorMessages: [],
    raw: body
  };
}
