# Landing live demo (`#demo`) design spec

**Date:** 2026-06-09
**Status:** Approved design, ready for planning
**Branch:** `claude/landing-demo` (off `main`)
**Companion docs:** `docs/superpowers/specs/2026-06-09-landing-content-rebuild.md`, `2026-06-09-landing-visual-design.md`

> Copy convention for this project: never use em or en dashes in user facing copy. All copy strings in this spec follow that rule, and so does the prose.

## 1. Goal

Fill the `#demo` placeholder on the rebuilt landing (`components/landing/landing-rebuild.tsx`, currently an empty `<section id="demo" aria-hidden />` between `Hero` and `OldWayComparison`) with an interactive live demo. The demo lets a visitor feel the product in a few seconds, then converts them into a free passwordless account through an email gated PDF download. Building this demo is the last piece before swapping the rebuilt landing onto `/` and `/en`.

## 2. Locked decisions (confirmed with the user)

| Topic | Decision |
| --- | --- |
| Input model | Hybrid. Lane 1 is an instant pre loaded sample reveal (default). Lane 2 is an opt in upload of the visitor's own invoice. |
| Launch sequencing | Build both lanes, then swap the landing. The upload lane ships at launch, so its guards must be solid first. |
| Sample invoice | A faithful KSeF FA(3) export invoice. Polish furniture exporter selling to a German GmbH, intra community supply at 0 percent (WDT), currency EUR. |
| Download gate | Email field. On submit the PDF downloads immediately, and in the background we fire a passwordless magic link so the email becomes a real account. |
| Bot defense | Cloudflare Turnstile on the public, money or email spending endpoints. |
| Layout | Centered stage on a dark navy panel. The translated invoice is the focus of the section. |

## 3. Non goals

- Do not loosen or reuse the existing authenticated routes (`/api/translate`, `/api/pdf`, `/api/upload*`). The demo gets its own isolated, stateless `/api/demo/*` endpoints.
- No multi invoice demo, no in demo editing, no saved demo history.
- The demo does not consume a credit. The PDF is a free taste. The account created via the gate starts with its normal monthly free credit intact.
- The 30 day deletion job (a known gap) is not built here. The demo sidesteps it by persisting nothing.
- The final `/` and `/en` swap is the closing step after the demo is built. It is described in section 12 and gets its own plan.

## 4. Architecture overview

Two lanes inside one section, sharing the same preview surface and the same email gate.

```
                 ┌──────────────────────── #demo section (dark stage) ───────────────────────┐
 Lane 1 (default)│  language chips ──> InvoicePreview (baked sample translations, instant)    │
                 │                         │                                                  │
 Lane 2 (opt in) │  "wgraj wlasna" ──> /api/demo/translate (stateless) ──> InvoicePreview     │
                 │                         │                                                  │
                 │                    [ Pobierz PDF ] ──> email gate ──> /api/demo/unlock      │
                 │                                             │ (Turnstile + rate limit)      │
                 │                                             ├─ signInWithOtp(email)          │
                 │                                             └─ signed downloadToken          │
                 │                                                   │                          │
                 │                                          /api/demo/pdf (stateless) ──> file  │
                 └───────────────────────────────────────────────────────────────────────────┘
```

### Reuse (existing code, do not modify)

- `lib/xml/parser.ts` -> `parseKsefXml(xml)` (pure).
- `lib/pdf/parser.ts` -> `parseKsefPdf` (dynamic import) for PDF uploads.
- `lib/translation/engine.ts` -> `translateInvoiceFreeText(invoice, language)`. Used directly and statelessly (we do not use the DB backed `getOrCreateTranslation` cache for the demo).
- `components/invoice-preview.tsx` -> `<InvoicePreview invoice language bilingual translated />`. Pure client component, the on screen wizualizacja.
- `lib/mf-fa3/official-renderer.ts` -> `renderOfficialFa3Pdf(input)` for the downloadable PDF.
- `app/login/login-form.tsx` pattern -> `supabase.auth.signInWithOtp(...)` for the passwordless signup.

### New modules and files

- `public/sample-data/demo-fa3-export.xml` the faithful sample (section 8).
- `lib/landing/demo-sample.ts` the parsed sample `Invoice` plus baked per language translation data for `<InvoicePreview>`.
- `lib/landing/copy.ts` extend with a `demo` copy group (pl + en, no dashes).
- `components/landing/demo/` the section UI, broken into small files:
  - `demo-section.tsx` the dark stage shell, composition, state.
  - `language-chips.tsx` the chip row (real buttons, `aria-pressed`).
  - `invoice-stage.tsx` the framed, watermarked, animated preview wrapper.
  - `upload-panel.tsx` Lane 2 dropzone and client side validation.
  - `download-gate.tsx` the email field, consent, Turnstile, submit.
- `app/api/demo/translate/route.ts` stateless parse + translate for Lane 2.
- `app/api/demo/unlock/route.ts` Turnstile verify + rate limit + `signInWithOtp` + issue download token.
- `app/api/demo/pdf/route.ts` stateless PDF render, requires a valid download token.
- `lib/demo/rate-limit.ts` IP hash rate limiting and the global circuit breaker.
- `lib/demo/turnstile.ts` server side Turnstile verification wrapper.
- `lib/demo/download-token.ts` sign and verify short lived HMAC download tokens.
- `supabase/migrations/<ts>_demo_usage.sql` the `demo_usage` table (section 7).

## 5. Data flow

### Lane 1, sample reveal (no network, no LLM)

1. The section renders with the baked sample. Default language is EN.
2. The visitor clicks a language chip. The client swaps `<InvoicePreview>` inputs to that language using baked translation data. No network call, instant, with a short swap shimmer (reduced motion shows an instant swap).
3. The visitor clicks "Pobierz PDF". The inline email gate expands.
4. On submit the client obtains a Turnstile token, then `POST /api/demo/unlock` with `{ email, lang, marketingOptIn, turnstileToken, source: "sample" }`.
5. The server verifies Turnstile, enforces the per IP unlock cap, fires `signInWithOtp(email, { options: { emailRedirectTo, data: { source: "landing_demo", marketing_opt_in } } })` (passing the marketing choice via `options.data` so it attaches to the user at creation, no separate consent table needed), and returns a short lived signed `downloadToken`.
6. The client calls `POST /api/demo/pdf` with `{ downloadToken, lang, source: "sample" }`. The server validates the token, renders the sample PDF via `renderOfficialFa3Pdf` (stateless), and streams it. The download starts. Nothing is persisted.

### Lane 2, upload (one stateless translate call per language)

1. The visitor clicks "albo wgraj wlasna fakture" and the dropzone reveals.
2. The client validates type and size locally, obtains a Turnstile token, then `POST /api/demo/translate` (multipart: `file`, `lang`, `turnstileToken`).
3. The server verifies Turnstile, enforces the per IP translate cap and the global circuit breaker, validates MIME and size, parses (`parseKsefXml` or `parseKsefPdf`), runs `translateInvoiceFreeText(invoice, lang)`, and returns the translated `Invoice` JSON plus the source XML needed for the PDF. Nothing is persisted.
4. The client renders `<InvoicePreview>` with the returned data.
5. Download uses the same gate. Because the path is stateless, the client holds the invoice and re sends `{ invoice, sourceXml, lang }` to `/api/demo/pdf` together with the `downloadToken`. The PDF is rendered and streamed. Nothing is persisted.
6. Switching languages after an upload triggers another `/api/demo/translate` call and counts against the per IP cap.

## 6. Privacy

The demo is stateless. No invoice bytes, parsed invoice, or generated PDF is ever written to the database or to storage. The only thing recorded is in `demo_usage`: a salted hash of the caller IP, the day, and counts. There is no link between an email and an invoice. `signInWithOtp` creates an auth user (email only); no invoice is attached to it.

UI promise on the section: "Nie przechowujemy Twojej faktury." / "We do not store your invoice."

## 7. Abuse and cost controls

Two public endpoints spend resources: `/api/demo/translate` (OpenAI tokens) and `/api/demo/unlock` (sends an email). Both are protected.

- **Cloudflare Turnstile** gates `/api/demo/translate` and `/api/demo/unlock`. Server side verification in `lib/demo/turnstile.ts` posts the token to the Turnstile siteverify endpoint with `TURNSTILE_SECRET_KEY`. A failed or missing token returns `403`.
- **Per IP rate limit** via `demo_usage`:
  ```sql
  create table public.demo_usage (
    ip_hash text not null,
    day date not null,
    translate_count integer not null default 0,
    unlock_count integer not null default 0,
    primary key (ip_hash, day)
  );
  ```
  Caps (env overridable): `DEMO_TRANSLATE_PER_IP_PER_DAY` default 5, `DEMO_UNLOCK_PER_IP_PER_DAY` default 5. Increment is an atomic upsert. Over cap returns `429`. The table is written with the service role client; RLS denies all client access.
- **Global circuit breaker**: a per day global translate counter (a row in `demo_usage` with a reserved sentinel `ip_hash = "__global__"`, or a dedicated tiny table). If global translate calls exceed `DEMO_GLOBAL_TRANSLATE_PER_DAY` default 500, `/api/demo/translate` returns `503` and Lane 2 shows the signup fallback message. This bounds worst case spend.
- **Size caps**: `DEMO_MAX_XML_BYTES` default 1 MB, `DEMO_MAX_PDF_BYTES` default 8 MB. Enforced client side (fast feedback) and server side (authoritative). Over size returns `413`.
- **MIME and extension**: reuse `detectSourceType`. Anything else returns `415`.
- **IP hashing**: `sha256(ip + DEMO_IP_SALT)`. The raw IP is never stored. IP is read from the platform forwarded header.
- **Download token**: `lib/demo/download-token.ts` signs `{ source, lang, nonce, exp }` with an HMAC server secret (`DEMO_TOKEN_SECRET`), TTL about 10 minutes. `/api/demo/pdf` rejects missing, tampered, or expired tokens with `401`. This stops anyone calling the PDF route without passing the gate.

## 8. The sample asset (faithful KSeF FA(3))

New file `public/sample-data/demo-fa3-export.xml`, a valid FA(3) document.

- Schema and header: namespace `http://crd.gov.pl/wzor/2025/06/25/13775/`, `KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E"`, `WariantFormularza` 3, with `Naglowek` (DataWytworzeniaFa, SystemInfo).
- `Podmiot1` (seller): NIP `7811924557`, Nazwa "Meble Debowe Nowak Sp. z o.o.", Adres KodKraju PL, AdresL1 "ul. Przemyslowa 14", AdresL2 "61-001 Poznan".
- `Podmiot2` (buyer): KodKraju DE, a German VAT identifier (`DE811569244`), Nazwa "Holzkontor Brandt GmbH", Adres in Berlin.
- `Fa`: KodWaluty EUR, P_1 (issue date) 2026-05-12, P_1M Poznan, P_2 "FV 2026/05/0142", P_6 (sale date) 2026-05-12, totals P_13 net 10200.00, VAT 0.00, P_15 gross 10200.00, the 0 percent WDT annotation, and three `FaWiersz` lines (oak table, oak chair, delivery and packaging) at rate 0.
- `Stopka`: Informacje (share capital), Rejestry (KRS, REGON, BDO), to match the real tell of a genuine invoice.
- A representative KSeF reference number is displayed in the rendered preview chrome (KSeF numbers are assigned by the system, so this is presentation only).

Requirements:
- The file must parse cleanly through `parseKsefXml` (an integration test asserts `ok: true` with no errors).
- Values must be internally consistent (line nets sum to P_13, VAT 0, gross equals net).
- The asset uses correct Polish diacritics (for example "Debowe" is written "Dębowe", "Przemyslowa" is "Przemysłowa", "Poznan" is "Poznań"). Diacritics are stripped in this doc only to keep it portable.

### Baked translations

`lib/landing/demo-sample.ts` exports the parsed sample `Invoice` and, for each demo language, the exact inputs `<InvoicePreview>` needs (`translated` payload, `bilingual: false`). Languages at launch: EN, DE, FR, ES, IT, CS (PL is the untranslated source). Note: Czech (CS) replaces the earlier "UK" because Ukrainian is not a member of the `LanguageCode` union in `types/invoice.ts`. The data is produced once (it may be generated by running `translateInvoiceFreeText` offline) and committed as static data, so the section needs no network and no LLM at runtime. A unit test asserts every language is present and that preserved fields (number, NIP, VAT id, IBAN, dates, amounts, KSeF id) are byte identical to the source across all languages.

## 9. Layout and visual (centered stage, dark panel)

- `<section id="demo">` on the dark `ink` background (`#0B1020`), consistent with the rebuild design system.
- Eyebrow plus h2 in Space Grotesk, centered, light text.
- Language chip row, EN active by default, then DE FR ES IT UK, then a "+ wiecej" chip (no hard count, the app supports many more). The plus chip opens the gate with a note that more languages unlock after signup (it does not attempt an instant swap).
- The "paper": `<InvoicePreview>` constrained to fit (scaled, top aligned, overflow hidden) inside a framed card with a faint "PODGLAD" watermark. The language swap reuses the hero showcase shimmer pattern (about 180 ms), gated by `motion-safe` and a JS reduced motion check.
- Secondary link "albo wgraj wlasna fakture" under the paper reveals the Lane 2 dropzone.
- Primary "Pobierz PDF" button reveals the inline email gate.
- Caption under the gate: "Nie przechowujemy Twojej faktury. Wyslemy plik i link do konta."
- Responsive: chips wrap, the paper scales, the gate stacks on mobile. Verified at 360, 768, 1024, 1440.
- Accessibility: chips are buttons with `aria-pressed`; the preview wrapper is labelled; focus visible rings use `ring-brand` (white ring on the dark surface); the upload input and the email field have labels; the Turnstile widget manages its own a11y; reduced motion disables the shimmer and swaps instantly.

## 10. Copy (pl + en, no em or en dashes)

The full strings live in `lib/landing/copy.ts` under a `demo` group. Anchors:

- Eyebrow: pl "Demo na zywo" / en "Live demo".
- Heading: pl "Zobacz swoja fakture w innym jezyku" / en "See your invoice in another language".
- Sub: pl "Wybierz jezyk i zobacz tlumaczenie od razu. Liczby, NIP, IBAN i kwoty zostaja takie same." / en "Pick a language and see the translation right away. Numbers, tax IDs, IBAN and amounts stay exactly the same.".
- Upload link: pl "albo wgraj wlasna fakture" / en "or upload your own invoice".
- Download button: pl "Pobierz PDF" / en "Download PDF".
- Email placeholder: pl "twoj@email.pl" / en "you@email.com".
- Consent line: pl "Wyslemy plik na podany adres i link do logowania. Zero spamu." / en "We will send the file and a sign in link to this address. No spam.".
- Marketing opt in (separate, unchecked): pl "Chce dostawac wskazowki o KSeF i fakturowaniu (opcjonalnie)." / en "I want tips about KSeF and invoicing (optional).".
- Privacy caption: pl "Nie przechowujemy Twojej faktury." / en "We do not store your invoice.".

A test extends the existing no dashes assertion to cover the `demo` group.

## 11. Error handling

All errors show a friendly inline message near the control and never leak internals. Server logs the detail.

| Case | HTTP | User message (pl) |
| --- | --- | --- |
| Unsupported file type | 415 | "Obslugujemy pliki XML i PDF z KSeF." |
| File too large | 413 | "Plik jest za duzy. Maks 1 MB dla XML, 8 MB dla PDF." |
| XML or PDF parse failure | 422 | "Nie udalo sie odczytac tej faktury. Upewnij sie, ze to plik FA(3) z KSeF." |
| Per IP rate limit | 429 | "Limit demo na dzis wyczerpany. Zaloz darmowe konto, aby tlumaczyc dalej." |
| Global circuit breaker | 503 | "Demo chwilowo przeciazone. Zaloz darmowe konto, aby przetlumaczyc wlasna fakture." |
| Turnstile failure | 403 | "Weryfikacja nie powiodla sie. Odswiez strone i sprobuj ponownie." |
| Translate failure | 502 | "Cos poszlo nie tak przy tlumaczeniu. Sprobuj ponownie za chwile." |
| PDF render failure | 500 | "Nie udalo sie wygenerowac PDF. Sprobuj ponownie." |
| Supabase OTP 429 | n/a | Allow the download anyway, show "Link do logowania wyslemy za chwile." |

## 12. Phasing (writing-plans will detail tasks)

Each sprint is one PR off `main`. Sprint N+1 starts after N merges.

- **Sprint A (Lane 1 reveal):** the sample asset, baked translations, `demo-sample` module, copy group, and the dark stage UI with language chips and the animated preview swap, on `/landing-preview`. The download button is present but its gate is stubbed until Sprint B.
- **Sprint B (the gate):** Turnstile wrapper, download token, `demo_usage` migration and rate limit, `/api/demo/unlock` and `/api/demo/pdf`, the `download-gate` UI, and `signInWithOtp`. Wired to Lane 1.
- **Sprint C (Lane 2 upload):** the `upload-panel` UI, `/api/demo/translate`, the global circuit breaker, size and MIME enforcement, and wiring upload into the stage and the gate.
- **Final swap (its own plan):** point `/` and `/en` at `LandingRebuild`, repoint the hero CTAs from `#demo` to the live demo anchor (now real), retire the old landing in `components/marketing/**`, and verify. This runs after Sprint C.

## 13. Testing (TDD, 80 percent plus)

- **Unit:** rate limit (IP hashing, cap enforcement, day rollover, global breaker), Turnstile verify wrapper (mock fetch, pass and fail), download token (valid, expired, tampered), baked sample integrity (all languages present, preserved fields identical), copy has no em or en dashes.
- **Integration:** `/api/demo/translate` (valid xml to translated invoice, oversized 413, bad mime 415, bad xml 422, rate limited 429, turnstile fail 403, breaker 503), `/api/demo/unlock` (valid fires OTP mock and issues token, turnstile fail 403, rate limited 429), `/api/demo/pdf` (valid token returns pdf bytes, bad or expired token 401), and `parseKsefXml` on `demo-fa3-export.xml`.
- **Component:** chips switch the preview language and set `aria-pressed`, upload reveals the dropzone, download reveals the email gate, reduced motion path swaps instantly.
- **E2E (Playwright) on `/landing-preview`:** the sample reveal renders, switching a chip changes a visible label, clicking download shows the email field, and a mocked upload happy path renders a preview. Extend `tests/e2e/landing-rebuild-preview.spec.ts` or add a dedicated demo spec.

## 14. Open items (defaults chosen, values needed at implementation)

- Cloudflare Turnstile keys: the user provisions `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
- Server secrets: `DEMO_IP_SALT`, `DEMO_TOKEN_SECRET`.
- Rate limit thresholds: defaults in section 7, overridable by env.
- Baked language set: default EN, DE, FR, ES, IT, CS (Czech; Ukrainian is not in the `LanguageCode` union). Easy to extend.
- Confirm the platform forwarded IP header name on the deploy target (Vercel) for `lib/demo/rate-limit.ts`.
