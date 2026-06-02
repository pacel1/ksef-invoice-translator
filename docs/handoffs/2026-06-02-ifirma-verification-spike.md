# Handoff: iFirma verification spike

**Date:** 2026-06-02
**Goal:** Confirm the iFirma auth works against live creds, then discover the real KSeF-status field names so we can tighten `getKsefStatus` before flipping `KSEF_LIVE=true`.
**Status of the code:** iFirma migration merged to `main` (PR #32). Everything is dormant behind `KSEF_LIVE=false`. Nothing has been issued yet.

---

## ⚠️ Step 0 — Rotate the API key first

The `faktura` key value was shown in chat (and is in the transcript). Before anything else: in the iFirma dashboard, **Konto → Konfiguracja → Klucze API → rotate the `faktura` key** (the circular-arrows icon). Use the *new* value below. The old one is compromised.

---

## Step 1 — Set creds locally

Create / edit `.env.local` in the repo root (it's gitignored — never put real keys in `.env.example`):

```env
IFIRMA_USERNAME=jhsledz@gmail.com
IFIRMA_INVOICE_KEY=<your NEW rotated faktura key, raw hex — e.g. CBBE10C7674DAE16-style>
```

- Username is your iFirma login. `jhsledz@gmail.com` is the right first guess. If Step 2 returns HTTP 401 / a signature error, check **Konto → Konfiguracja → Użytkownicy API** — some accounts have a separate API username distinct from the email.
- The key goes in raw, exactly as shown in the dashboard (hex, case-insensitive). The probe hex-decodes it before signing, matching `lib/billing/ifirma/client.ts`.

---

## Step 2 — Confirm auth (read-only, issues nothing)

```bash
node scripts/ifirma-probe.mjs
```

This signs and sends `GET /iapi/faktury.json?dataOd=2026-01-01&dataDo=2026-12-31` — a pure list query, zero side effects.

**Success looks like:**
```
HTTP 200
Kod: 0 (0 = success → auth + username are correct)
Found N invoice(s).
  FakturaId=12345678  58/12/2026  CzyWyslano=true  Brutto=95.94 PLN
  ...
```

- `Kod: 0` → our HMAC signature and username are correct. ✅ Auth is proven.
- HTTP 401 / signature error → username is likely wrong (try the API-users screen) or the key was pasted with stray whitespace.
- `Kod` ≠ 0 with a message → read the `Informacja` text; usually a permissions/date-range issue, not an auth failure.

---

## Step 3 — Discover the KSeF-status field names

This is the important one. Pick a `FakturaId` from the Step 2 list — **ideally one that already went through KSeF** (`CzyWyslano=true`). Then:

```bash
node scripts/ifirma-probe.mjs <FakturaId>
```

It dumps the full `response.*` body of `GET /iapi/fakturakraj/<id>.json` and highlights any key matching `ksef|gov|status|numer|wysl|upo`.

**Paste back ONLY the response body** (here in chat, or wherever we continue). Redact NIP / business names if you want — we only need the **field names**, e.g. whether the KSeF reference number lives under `NumerKSeF`, `KSeF`, `IdentyfikatorKsef`, `NrKSeF`, a nested object, etc., and what the "accepted / pending / rejected" status field is called.

If you have no KSeF-sent invoice yet, that's fine — we can do this after the first real issue once `KSEF_LIVE=true`. But doing it now (against any historical invoice) de-risks the cutover.

---

## What I do with the results

Once you paste the body, I tighten **`lib/billing/ifirma/get-status.ts`**. Right now it's deliberately defensive (see the file): it scans for any key containing `"ksef"` whose value matches a 35-char numer-KSeF regex, and **falls back to `processing` for everything else**. That's safe but blunt — it can't distinguish:

- **accepted** (real KSeF number present) → should map to `gov_status: "ok"` ✅ (this part works today if the field name contains "ksef")
- **rejected by KSeF** → should map to `send_error` (today it wrongly sits on `processing`)
- **genuinely still pending** → `processing` ✅

The risk with the current blunt version: a **rejected** invoice never reaches a terminal state — it polls `processing` until `attempt_count` hits `MAX_ATTEMPTS` (5) and then silently stops, with no `send_error` surfaced to you. After I know the real field names I'll map:
- the KSeF number field → `govId` + `govStatus: "ok"`
- the rejection/error field → `govStatus: "send_error"` + `errorMessages`
- and tighten the regex if iFirma's format differs.

The raw body is already `console.info`-logged by `getKsefStatus` in production too (look for `[ifirma/get-status] raw KSeF status body`), so we can also harvest the shape from Vercel logs after the first live issue — but the probe is faster and doesn't require going live.

---

## Then: the go-live checklist (for later, after the spike)

1. Set `IFIRMA_USERNAME` + `IFIRMA_INVOICE_KEY` in **Vercel → project env vars** (production).
2. Make sure `CRON_SECRET` is set in Vercel (Vercel Cron auto-injects `Authorization: Bearer $CRON_SECRET`; without it the cron 401s).
3. I land the tightened `getKsefStatus`.
4. Flip `KSEF_LIVE=true`.
5. Make one real Stripe test purchase → watch a `ksef_invoices` row go `pending → processing → ok`, `provider_invoice_id` + `gov_id` populated.
6. Refund it → confirm the korekta path (issue + send + poll to `ok`).
7. Download the PDF from `/billing` (streams via `/api/invoices/[id]/pdf`).

---

## Open follow-ups unrelated to this spike (tracked separately)

- **PR #30** ("skip just-issued rows in same poll cycle") — conflicts resolved, now `MERGEABLE`, awaiting merge.
- **Korekta idempotency guard** (`fix(cron): apply idempotency guard to korekta branch…`, commit `dd3b39e`) — was pushed to the iFirma branch *after* PR #32 merged, so it **never reached `main`**. It needs cherry-picking onto a fresh branch off `main` and a small PR. Without it, a korekta whose `sendToKsef` fails after `issueKorekta` succeeded will be re-created (duplicate) on the next cron tick. Low likelihood (requires a mid-flow crash), but real.

---

## Reference

- Probe script: `scripts/ifirma-probe.mjs`
- Adapter: `lib/billing/ifirma/` (auth.ts = HMAC signer, client.ts = HTTP + signing, get-status.ts = the file to tighten)
- iFirma docs: auth https://api.ifirma.pl/naglowek-autoryzacji/ · KSeF send https://api.ifirma.pl/wysylanie-faktury-do-ksef/ · invoice list https://api.ifirma.pl/lista-faktur/
- Migration plan (full context): `docs/superpowers/plans/2026-05-28-ifirma-ksef-migration.md`
