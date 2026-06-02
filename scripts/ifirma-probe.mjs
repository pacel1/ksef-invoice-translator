#!/usr/bin/env node
// iFirma API verification probe — READ-ONLY, issues nothing.
//
// Purpose:
//   1. Confirm our HMAC-SHA1 auth signature + username are correct.
//   2. Discover the real KSeF-status field names iFirma returns on a single
//      invoice (their docs don't document them), so we can tighten
//      lib/billing/ifirma/get-status.ts.
//
// The signing here is a 1:1 copy of lib/billing/ifirma/client.ts:
//   hmac = HMAC_SHA1( hexDecode(IFIRMA_INVOICE_KEY),
//                     urlWithoutQuery + username + "faktura" + body )
//   body is "" for GET. The URL is stripped of its query string before signing.
//
// Usage:
//   1) Put creds in .env.local (the script auto-loads it) OR export them:
//        IFIRMA_USERNAME=jhsledz@gmail.com
//        IFIRMA_INVOICE_KEY=<your rotated faktura key, raw hex>
//   2) Run the auth check (lists invoices in 2026 — zero side effects):
//        node scripts/ifirma-probe.mjs
//   3) Once you see an invoice FakturaId in the list (or you know one that
//      went through KSeF), dump its full body to reveal the KSeF fields:
//        node scripts/ifirma-probe.mjs <fakturaId>
//
// Paste back ONLY the response body. Redact NIP / business names if you like —
// the KSeF status/number field NAMES are what matter, not the values.

import crypto from "node:crypto";
import { readFileSync } from "node:fs";

// ── Minimal .env.local loader (no dependency on dotenv) ────────────────────
function loadEnvLocal() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      // Strip surrounding quotes and trailing comments.
      val = val.replace(/^['"]|['"]$/g, "");
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // No .env.local — rely on exported env vars.
  }
}
loadEnvLocal();

const username = process.env.IFIRMA_USERNAME;
const keyHex = process.env.IFIRMA_INVOICE_KEY;
const base = process.env.IFIRMA_BASE_URL ?? "https://www.ifirma.pl/iapi";

if (!username || !keyHex) {
  console.error(
    "❌ Missing IFIRMA_USERNAME and/or IFIRMA_INVOICE_KEY.\n" +
      "   Add them to .env.local or export them, then re-run."
  );
  process.exit(1);
}

const KEY_NAME = "faktura";

function stripQuery(url) {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

function authHeader(fullUrl, body = "") {
  const message = stripQuery(fullUrl) + username + KEY_NAME + body;
  const hmac = crypto
    .createHmac("sha1", Buffer.from(keyHex, "hex"))
    .update(message, "utf8")
    .digest("hex");
  return `IAPIS user=${username}, hmac-sha1=${hmac}`;
}

async function getJson(fullUrl) {
  const res = await fetch(fullUrl, {
    method: "GET",
    headers: { Accept: "application/json", Authentication: authHeader(fullUrl) }
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

async function main() {
  const invoiceId = process.argv[2];

  if (!invoiceId) {
    // ── Step 1: auth check via the invoice list (read-only) ──────────────
    const url = `${base}/faktury.json?dataOd=2026-01-01&dataDo=2026-12-31`;
    console.log("→ GET", url);
    const { status, json, text } = await getJson(url);
    console.log("HTTP", status);
    if (!json) {
      console.log("Non-JSON body:\n", text);
      return;
    }
    const kod = json.response?.Kod;
    console.log("Kod:", kod, "(0 = success → auth + username are correct)");
    console.log("Informacja:", json.response?.Informacja ?? "");
    const wynik = json.response?.Wynik ?? [];
    console.log(`Found ${wynik.length} invoice(s).`);
    for (const w of wynik.slice(0, 10)) {
      console.log(
        `  FakturaId=${w.FakturaId}  ${w.PelnyNumer}  CzyWyslano=${w.CzyWyslano}  Brutto=${w.Brutto} ${w.Waluta}`
      );
    }
    console.log(
      "\nNext: pick a FakturaId above (ideally one already sent to KSeF) and run:\n" +
        `  node scripts/ifirma-probe.mjs <FakturaId>\n` +
        "Then paste the body so we can map the real KSeF status/number fields."
    );
    return;
  }

  // ── Step 2: dump a single invoice to reveal KSeF status field names ────
  const url = `${base}/fakturakraj/${encodeURIComponent(invoiceId)}.json`;
  console.log("→ GET", url);
  const { status, json, text } = await getJson(url);
  console.log("HTTP", status);
  if (!json) {
    console.log("Non-JSON body:\n", text);
    return;
  }
  console.log("Kod:", json.response?.Kod);
  const inner = json.response ?? json;
  // Surface any key that looks KSeF-related so it's easy to spot.
  const ksefKeys = Object.keys(inner).filter((k) =>
    /ksef|gov|status|numer|wysl|upo/i.test(k)
  );
  console.log("\n⚑ Candidate KSeF-related keys:", ksefKeys.length ? ksefKeys : "(none obvious — see full body)");
  console.log("\nFull response.* body (redact NIP/names if you want):");
  console.log(JSON.stringify(inner, null, 2));
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
