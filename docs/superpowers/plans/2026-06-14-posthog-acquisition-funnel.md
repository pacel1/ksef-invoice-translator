# PostHog Acquisition Funnel (PR2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instrument the landing-page demo funnel, auth completion, onboarding, sign-out, and landing CTA clicks as typed PostHog events, then build themed PostHog dashboards (Acquisition/Demo, Activation, Quality/Engagement) so we can see where the landing → demo → email → signup → activation funnel leaks.

**Architecture:** All events go through the existing typed catalog (`lib/analytics/events.ts`) and the existing wrappers `captureClient` (browser) / `captureServer` (route handlers). No raw `posthog.capture` outside `lib/analytics/`. Client events fire at the fetch call sites in client components; the two auth-completion events fire server-side in `app/auth/callback/route.ts`. Dashboards are created via the PostHog MCP after the events are merged and flowing.

**Tech Stack:** Next.js 15 App Router, TypeScript, `posthog-js` / `posthog-node`, Vitest + Testing Library (jsdom), Playwright (E2E), PostHog Cloud EU (project 199578).

**This is PR2 of the approved spec** `docs/superpowers/specs/2026-06-11-posthog-analytics-design.md` §5–§7. PR1 (foundation, 14 events) is merged and live. PR3 (product-depth events: paywall, editor, language toggles, account) is explicitly **out of scope** here.

---

## Scope: events added in this plan

14 new events (total catalog goes from 14 → 28):

**Demo (client, `components/landing/demo/`):**
`demo_language_selected`, `demo_file_uploaded`, `demo_translation_completed`, `demo_translation_failed`, `demo_download_gate_opened`, `demo_email_submitted`, `demo_pdf_downloaded`

**Auth (server `app/auth/callback/route.ts`, except `auth_failed` which is client):**
`signup_completed`, `login_completed`, `auth_failed`

**Onboarding / session (client):**
`onboarding_name_shown`, `onboarding_name_completed`, `signed_out`

**Landing (client wrapper):**
`landing_cta_clicked`

**Explicitly deferred** (not in this plan): `contact_form_submitted` (no verified contact-form integration point) and all PR3 product-depth events.

---

## File structure

**Modify:**
- `lib/analytics/events.ts` — add 14 events to `AnalyticsEventMap` + `EVENT_PROPERTY_WITNESS`.
- `tests/lib/analytics/events.test.ts` — extend the hard-coded event-name list (28 names).
- `components/landing/demo/demo-section.tsx` — `demo_language_selected`, `demo_download_gate_opened`.
- `components/landing/demo/upload-panel.tsx` — `demo_file_uploaded`, `demo_translation_completed`, `demo_translation_failed`.
- `components/landing/demo/download-gate.tsx` — `demo_email_submitted`, `demo_pdf_downloaded`.
- `app/auth/callback/route.ts` — `signup_completed`, `login_completed`.
- `app/login/login-form.tsx` — `auth_failed` (read `?error`).
- `components/account/onboarding-name-modal.tsx` — `onboarding_name_shown`, `onboarding_name_completed`.
- `components/layout/sign-out-button.tsx` — `signed_out`.
- `components/landing/hero.tsx`, `site-nav.tsx`, `pricing-teaser.tsx`, `final-cta.tsx`, `mobile-nav-sheet.tsx` — use the new tracked CTA component.
- `docs/analytics.md` — event catalog table + dashboards section.

**Create:**
- `lib/analytics/demo-status.ts` — pure helper mapping HTTP status → demo `error_code`.
- `components/landing/ui/tracked-cta-link.tsx` — client wrapper firing `landing_cta_clicked`.
- `tests/lib/analytics/demo-status.test.ts`
- `tests/components/landing/demo/demo-section.test.tsx`
- `tests/components/landing/demo/upload-panel.test.tsx`
- `tests/components/landing/demo/download-gate.test.tsx`
- `tests/app/auth/callback-analytics.test.ts`
- `tests/components/landing/ui/tracked-cta-link.test.tsx`
- (Extend existing) `tests/components/account/onboarding-name-modal.test.tsx` and a sign-out-button test if absent.

---

## Phase 0: Branch setup

- [ ] **Step 0.1: Create an isolated branch off `main`** (per project branching rule; do not branch off the current stale `claude/google-ads-advanced-consent`).

```bash
git fetch origin main
git worktree add -b claude/posthog-acquisition-funnel .claude/worktrees/posthog-acquisition-funnel origin/main
cd .claude/worktrees/posthog-acquisition-funnel
npm install
```

- [ ] **Step 0.2: Move this plan into the worktree and confirm baseline tests pass.**

```bash
# copy this plan file into the worktree's docs/superpowers/plans/ if not already present
npx vitest run tests/lib/analytics/events.test.ts
```
Expected: PASS (14 events). This is the green baseline before any change.

---

## Phase 1: Event catalog (foundation — everything depends on this)

### Task 1: Add the 14 PR2 events to the typed catalog

**Files:**
- Modify: `lib/analytics/events.ts`
- Test: `tests/lib/analytics/events.test.ts`

- [ ] **Step 1.1: Update the catalog test's expected event list (RED).** In `tests/lib/analytics/events.test.ts`, find the test asserting `Object.keys(EVENT_PROPERTY_KEYS).sort()` equals the hard-coded 14-name array. Replace that array with the full 28-name sorted list:

```ts
const EXPECTED_EVENTS = [
  "auth_failed",
  "checkout_initiated",
  "checkout_session_created",
  "demo_download_gate_opened",
  "demo_email_submitted",
  "demo_file_uploaded",
  "demo_language_selected",
  "demo_pdf_downloaded",
  "demo_translation_completed",
  "demo_translation_failed",
  "files_uploaded",
  "google_signin_clicked",
  "invoice_translated",
  "landing_cta_clicked",
  "login_completed",
  "login_email_sent",
  "login_submitted",
  "onboarding_name_completed",
  "onboarding_name_shown",
  "payment_completed",
  "payment_failed",
  "payment_refunded",
  "pdf_downloaded",
  "signed_out",
  "signup_completed",
  "translation_batch_cancelled",
  "translation_started",
  "zip_downloaded"
].sort();
```
(Keep whatever assertion form the test currently uses — e.g. `expect(Object.keys(EVENT_PROPERTY_KEYS).sort()).toEqual(EXPECTED_EVENTS);`.)

- [ ] **Step 1.2: Run the catalog test to confirm it fails (RED).**

Run: `npx vitest run tests/lib/analytics/events.test.ts`
Expected: FAIL — the actual keys (14) don't match the expected 28.

- [ ] **Step 1.3: Extend `AnalyticsEventMap` (GREEN impl part 1).** In `lib/analytics/events.ts`, add these members to the `AnalyticsEventMap` interface (after the existing members):

```ts
  // ── Marketing / landing ───────────────────────────────────────────
  landing_cta_clicked: {
    cta_id:
      | "hero_primary"
      | "hero_secondary"
      | "nav_login"
      | "mobile_nav"
      | "pricing_teaser"
      | "final_cta";
    locale: string;
  };

  // ── Demo funnel (anonymous, landing page) ─────────────────────────
  demo_language_selected: { language: string; lane: "sample" | "upload" };
  demo_file_uploaded: {
    status: "success" | "invalid" | "rate_limited" | "error";
    error_code?: string;
  };
  demo_translation_completed: { language: string; lane: "sample" | "upload" };
  demo_translation_failed: {
    language: string;
    lane: "sample" | "upload";
    error_code: string;
  };
  demo_download_gate_opened: {
    trigger: "download" | "more_languages";
    lane: "sample" | "upload";
  };
  demo_email_submitted: {
    status: "success" | "rate_limited" | "error";
    marketing_opt_in: boolean;
    lane: "sample" | "upload";
  };
  demo_pdf_downloaded: { language: string; lane: "sample" | "upload" };

  // ── Auth / onboarding ─────────────────────────────────────────────
  signup_completed: {
    method: "magic_link" | "google";
    signup_source: "landing_demo" | "direct";
  };
  login_completed: { method: "magic_link" | "google" };
  auth_failed: { reason: string };
  onboarding_name_shown: Record<string, never>;
  onboarding_name_completed: Record<string, never>;
  signed_out: Record<string, never>;
```

- [ ] **Step 1.4: Extend `EVENT_PROPERTY_WITNESS` (GREEN impl part 2).** Add matching witness entries (every property key listed as `true`, optional ones included):

```ts
  landing_cta_clicked: { cta_id: true, locale: true },
  demo_language_selected: { language: true, lane: true },
  demo_file_uploaded: { status: true, error_code: true },
  demo_translation_completed: { language: true, lane: true },
  demo_translation_failed: { language: true, lane: true, error_code: true },
  demo_download_gate_opened: { trigger: true, lane: true },
  demo_email_submitted: { status: true, marketing_opt_in: true, lane: true },
  demo_pdf_downloaded: { language: true, lane: true },
  signup_completed: { method: true, signup_source: true },
  login_completed: { method: true },
  auth_failed: { reason: true },
  onboarding_name_shown: {},
  onboarding_name_completed: {},
  signed_out: {},
```

- [ ] **Step 1.5: Run the catalog + typecheck (GREEN).**

Run: `npx vitest run tests/lib/analytics/events.test.ts && npx tsc --noEmit`
Expected: PASS. The PII guard already iterates `EVENT_PROPERTY_KEYS`; none of the new keys match a forbidden pattern (`status`, `lane`, `language`, `cta_id`, `locale`, `trigger`, `marketing_opt_in`, `error_code`, `method`, `signup_source`, `reason` are all PII-safe).

- [ ] **Step 1.6: Commit.**

```bash
git add lib/analytics/events.ts tests/lib/analytics/events.test.ts
git commit -m "feat(analytics): add PR2 acquisition events to typed catalog"
```

---

## Phase 2: Demo funnel events

### Task 2: HTTP-status → demo error_code helper

**Files:**
- Create: `lib/analytics/demo-status.ts`
- Test: `tests/lib/analytics/demo-status.test.ts`

- [ ] **Step 2.1: Write the failing test (RED).** Create `tests/lib/analytics/demo-status.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { demoErrorCodeFromStatus } from "@/lib/analytics/demo-status";

describe("demoErrorCodeFromStatus", () => {
  it("maps known HTTP statuses to stable codes", () => {
    expect(demoErrorCodeFromStatus(429)).toBe("rate_limited");
    expect(demoErrorCodeFromStatus(415)).toBe("unsupported");
    expect(demoErrorCodeFromStatus(413)).toBe("too_large");
    expect(demoErrorCodeFromStatus(422)).toBe("parse_failed");
    expect(demoErrorCodeFromStatus(503)).toBe("circuit_breaker");
    expect(demoErrorCodeFromStatus(403)).toBe("turnstile");
    expect(demoErrorCodeFromStatus(502)).toBe("translate_failed");
  });

  it("falls back to 'error' for unmapped statuses", () => {
    expect(demoErrorCodeFromStatus(400)).toBe("error");
    expect(demoErrorCodeFromStatus(500)).toBe("error");
  });

  it("returns 'network' when status is undefined (fetch threw)", () => {
    expect(demoErrorCodeFromStatus(undefined)).toBe("network");
  });
});
```

- [ ] **Step 2.2: Run it to confirm it fails (RED).**

Run: `npx vitest run tests/lib/analytics/demo-status.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement the helper (GREEN).** Create `lib/analytics/demo-status.ts`:

```ts
/**
 * Maps a demo API HTTP status code to a stable, PII-free analytics error_code.
 * Mirrors the STATUS_ERRORS map in components/landing/demo/upload-panel.tsx but
 * emits analytics codes (stable across locales), not copy keys.
 * `undefined` status means the fetch threw before a response (network error).
 */
const STATUS_CODES: Record<number, string> = {
  403: "turnstile",
  413: "too_large",
  415: "unsupported",
  422: "parse_failed",
  429: "rate_limited",
  502: "translate_failed",
  503: "circuit_breaker"
};

export function demoErrorCodeFromStatus(status: number | undefined): string {
  if (status === undefined) return "network";
  return STATUS_CODES[status] ?? "error";
}

/** True when a demo response status is a rate limit (HTTP 429). */
export function isRateLimited(status: number | undefined): boolean {
  return status === 429;
}
```

- [ ] **Step 2.4: Run it (GREEN).**

Run: `npx vitest run tests/lib/analytics/demo-status.test.ts`
Expected: PASS.

- [ ] **Step 2.5: Commit.**

```bash
git add lib/analytics/demo-status.ts tests/lib/analytics/demo-status.test.ts
git commit -m "feat(analytics): demo HTTP-status to error_code helper"
```

### Task 3: `demo_language_selected` + `demo_download_gate_opened` in demo-section

**Files:**
- Modify: `components/landing/demo/demo-section.tsx`
- Test: `tests/components/landing/demo/demo-section.test.tsx`

Context (current code, verbatim):
```tsx
17  const [lang, setLang] = useState<DemoLang>(/* default */);
19  const [upload, setUpload] = useState<DemoUpload | null>(null);
...
31  <LanguageChips value={lang} onChange={setLang} label={t.languagesLabel} />
32  <button type="button" onClick={() => setGateOpen(true)} aria-label={t.moreAria}>   // "more_languages"
...
52  <button type="button" onClick={() => setGateOpen(true)} className="... bg-brand ...">  // "download"
```

- [ ] **Step 3.1: Write the failing test (RED).** Create `tests/components/landing/demo/demo-section.test.tsx`. Mirror the delivery-step mock idiom:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DemoSection } from "@/components/landing/demo/demo-section";

const captureClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  captureClient: captureClientMock,
  captureClientError: vi.fn()
}));

describe("DemoSection analytics", () => {
  beforeEach(() => captureClientMock.mockClear());

  it("captures demo_language_selected with lane=sample when a chip is clicked (no upload)", () => {
    render(<DemoSection locale="pl" />);
    // click a non-default language chip (adjust the accessible name to a real one)
    fireEvent.click(screen.getByRole("button", { name: /English|angielski/i }));
    expect(captureClientMock).toHaveBeenCalledWith(
      "demo_language_selected",
      expect.objectContaining({ lane: "sample" })
    );
  });

  it("captures demo_download_gate_opened with the right trigger", () => {
    render(<DemoSection locale="pl" />);
    fireEvent.click(screen.getByRole("button", { name: /więcej języków|more languages/i }));
    expect(captureClientMock).toHaveBeenCalledWith(
      "demo_download_gate_opened",
      { trigger: "more_languages", lane: "sample" }
    );
  });
});
```
Note: confirm the actual accessible names from `lib/landing/copy.ts` / the chip labels and adjust the regexes. If `DemoSection` requires more props than `locale`, pass the minimal real props.

- [ ] **Step 3.2: Run it to confirm it fails (RED).**

Run: `npx vitest run tests/components/landing/demo/demo-section.test.tsx`
Expected: FAIL — `captureClient` not called.

- [ ] **Step 3.3: Implement (GREEN).** In `components/landing/demo/demo-section.tsx`:

1. Add the import at the top: `import { captureClient } from "@/lib/analytics/client";`
2. Add a lane helper near the state: `const lane = upload ? "upload" : "sample";` (place after the `upload` state on line 19; reuse it below).
3. Replace the `onChange={setLang}` on line 31 with an inline handler:
```tsx
<LanguageChips
  value={lang}
  onChange={(code) => {
    captureClient("demo_language_selected", { language: code, lane });
    setLang(code);
  }}
  label={t.languagesLabel}
/>
```
4. Replace the "more languages" button onClick (line 32) — guard against re-firing when already open:
```tsx
onClick={() => {
  if (!gateOpen) {
    captureClient("demo_download_gate_opened", { trigger: "more_languages", lane });
  }
  setGateOpen(true);
}}
```
5. Replace the "download" button onClick (line 52):
```tsx
onClick={() => {
  if (!gateOpen) {
    captureClient("demo_download_gate_opened", { trigger: "download", lane });
  }
  setGateOpen(true);
}}
```

- [ ] **Step 3.4: Run it (GREEN).**

Run: `npx vitest run tests/components/landing/demo/demo-section.test.tsx`
Expected: PASS.

- [ ] **Step 3.5: Commit.**

```bash
git add components/landing/demo/demo-section.tsx tests/components/landing/demo/demo-section.test.tsx
git commit -m "feat(analytics): demo language selection and gate-open events"
```

### Task 4: `demo_file_uploaded` + `demo_translation_completed` + `demo_translation_failed` in upload-panel

**Files:**
- Modify: `components/landing/demo/upload-panel.tsx`
- Test: `tests/components/landing/demo/upload-panel.test.tsx`

Decision (locks the overlap):
- `demo_file_uploaded` fires **once per real file selection** — `status: "invalid"` in `handleFiles` pre-checks (file never sent), otherwise `status: success | rate_limited | error` after the upload's `doTranslate` resolves. Language-switch re-translates do **not** re-fire `demo_file_uploaded`.
- `demo_translation_completed` / `demo_translation_failed` fire on **every** `doTranslate` outcome in the upload lane (initial upload AND re-translate). `lane` is always `"upload"` here (the sample lane never calls `/api/demo/translate`).

Implementation approach: thread a `countAsUpload` boolean through the translate path. The file-selection entry passes `true`; the language-change `useEffect` passes `false`.

Context (current code, verbatim):
```tsx
41  const STATUS_ERRORS: Record<number, string> = { 415:..., 413:..., 422:..., 429:"rateLimited", 503:..., 403:... };
73  useEffect(() => { /* re-translate on lang change */ void translate(fileRef.current, lang); }, [lang]);
80  function handleFiles(list: FileList | null) {
83    if (!isDemoXmlUpload(file.name, file.type)) { setErrorKey("uploadErrUnsupported"); return; }
87    if (file.size > maxXmlBytes()) { setErrorKey("uploadErrTooLarge"); return; }
91    fileRef.current = file;
92    void translate(file, lang);
93  }
...
114  async function doTranslate(file, target) {
119    const res = await fetch("/api/demo/translate", { method: "POST", body: form });
120    if (!res.ok) { setErrorKey(STATUS_ERRORS[res.status] ?? "uploadErrTranslate"); return; }
124    const data = (await res.json()) as {...};
126    onResult({ ... lang: target });
127  } catch { setErrorKey("uploadErrTranslate"); } finally { setBusy(false); }
```
(Confirm the exact `translate` / `doTranslate` signatures and the `useEffect` call site at execution time; line numbers may shift.)

- [ ] **Step 4.1: Write the failing test (RED).** Create `tests/components/landing/demo/upload-panel.test.tsx`. Mock `captureClient`, the demo-status helper is real, and stub `fetch`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UploadPanel } from "@/components/landing/demo/upload-panel";

const captureClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  captureClient: captureClientMock,
  captureClientError: vi.fn()
}));

function uploadFile(name = "invoice.xml", type = "text/xml", size = 1024) {
  const file = new File(["<x/>"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  const input = screen.getByLabelText(/upload|wgraj|plik/i) as HTMLInputElement; // adjust
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

describe("UploadPanel analytics", () => {
  beforeEach(() => {
    captureClientMock.mockClear();
    vi.restoreAllMocks();
  });

  it("captures demo_file_uploaded status=invalid for an unsupported file (no fetch)", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    render(<UploadPanel lang="en" /* + minimal required props */ />);
    uploadFile("notxml.txt", "text/plain");
    expect(captureClientMock).toHaveBeenCalledWith(
      "demo_file_uploaded",
      { status: "invalid", error_code: "unsupported" }
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("captures success + translation_completed on a 200 upload", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ invoice: {}, sourceXml: "<x/>", uploadToken: "t" }), { status: 200 })
    );
    render(<UploadPanel lang="en" /* props */ />);
    uploadFile();
    await vi.waitFor(() => {
      expect(captureClientMock).toHaveBeenCalledWith("demo_file_uploaded", { status: "success" });
      expect(captureClientMock).toHaveBeenCalledWith(
        "demo_translation_completed",
        { language: "en", lane: "upload" }
      );
    });
  });

  it("captures rate_limited + translation_failed on a 429", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("", { status: 429 }));
    render(<UploadPanel lang="en" /* props */ />);
    uploadFile();
    await vi.waitFor(() => {
      expect(captureClientMock).toHaveBeenCalledWith(
        "demo_file_uploaded",
        { status: "rate_limited", error_code: "rate_limited" }
      );
      expect(captureClientMock).toHaveBeenCalledWith(
        "demo_translation_failed",
        { language: "en", lane: "upload", error_code: "rate_limited" }
      );
    });
  });
});
```
Note: adjust the file-input accessible name and `UploadPanel` props to the real ones (check how `DemoSection` renders it). If the input is hidden behind a drop zone, trigger via the underlying `<input type="file">`.

- [ ] **Step 4.2: Run it to confirm it fails (RED).**

Run: `npx vitest run tests/components/landing/demo/upload-panel.test.tsx`
Expected: FAIL.

- [ ] **Step 4.3: Implement (GREEN).** In `components/landing/demo/upload-panel.tsx`:

1. Imports:
```tsx
import { captureClient } from "@/lib/analytics/client";
import { demoErrorCodeFromStatus, isRateLimited } from "@/lib/analytics/demo-status";
```
2. In `handleFiles`, fire `demo_file_uploaded` with `status:"invalid"` in each client-side reject branch, before `return`:
```tsx
if (!isDemoXmlUpload(file.name, file.type)) {
  captureClient("demo_file_uploaded", { status: "invalid", error_code: "unsupported" });
  setErrorKey("uploadErrUnsupported");
  return;
}
if (file.size > maxXmlBytes()) {
  captureClient("demo_file_uploaded", { status: "invalid", error_code: "too_large" });
  setErrorKey("uploadErrTooLarge");
  return;
}
```
3. Thread `countAsUpload` through the translate path. Change the file-selection call (line 92) to pass the flag, and the `useEffect` re-translate (line 73) to pass `false`. Update the `translate`/`doTranslate` signatures to accept `countAsUpload: boolean` (default `false`).
   - `handleFiles`: `void translate(file, lang, true);`
   - `useEffect` re-translate: `void translate(fileRef.current, lang, false);`
4. In `doTranslate`, fire the outcome events. Success branch (after the response is parsed, at/near the `onResult` call):
```tsx
const data = (await res.json()) as { invoice: Invoice; sourceXml: string; uploadToken: string };
translatedLangRef.current = target;
if (countAsUpload) {
  captureClient("demo_file_uploaded", { status: "success" });
}
captureClient("demo_translation_completed", { language: target, lane: "upload" });
onResult({ invoice: data.invoice, sourceXml: data.sourceXml, uploadToken: data.uploadToken, lang: target });
```
   Error branch (`if (!res.ok)`):
```tsx
if (!res.ok) {
  const error_code = demoErrorCodeFromStatus(res.status);
  if (countAsUpload) {
    captureClient("demo_file_uploaded", {
      status: isRateLimited(res.status) ? "rate_limited" : "error",
      error_code
    });
  }
  captureClient("demo_translation_failed", { language: target, lane: "upload", error_code });
  setErrorKey(STATUS_ERRORS[res.status] ?? "uploadErrTranslate");
  return;
}
```
   Catch branch (network):
```tsx
} catch {
  if (countAsUpload) {
    captureClient("demo_file_uploaded", { status: "error", error_code: "network" });
  }
  captureClient("demo_translation_failed", { language: target, lane: "upload", error_code: "network" });
  setErrorKey("uploadErrTranslate");
} finally {
  setBusy(false);
}
```

- [ ] **Step 4.4: Run it (GREEN).**

Run: `npx vitest run tests/components/landing/demo/upload-panel.test.tsx`
Expected: PASS.

- [ ] **Step 4.5: Commit.**

```bash
git add components/landing/demo/upload-panel.tsx tests/components/landing/demo/upload-panel.test.tsx
git commit -m "feat(analytics): demo file-upload and translation outcome events"
```

### Task 5: `demo_email_submitted` + `demo_pdf_downloaded` in download-gate

**Files:**
- Modify: `components/landing/demo/download-gate.tsx`
- Test: `tests/components/landing/demo/download-gate.test.tsx`

Context (current `submit`, verbatim):
```tsx
28  // props include `upload`, `lang`
34  const [marketingOptIn, setMarketingOptIn] = useState(false);
...
52  const unlock = await fetch("/api/demo/unlock", { method: "POST", ... });
63  if (unlock.status === 429) return fail("rate_limited");
64  if (!unlock.ok) return fail("error");
65  const { downloadToken } = (await unlock.json()) as { downloadToken: string };
67  const pdf = await fetch("/api/demo/pdf", { method: "POST", ... });
76  if (pdf.status === 429) return fail("rate_limited");
77  if (!pdf.ok) return fail("pdf_failed");
78  triggerDownload(await pdf.blob(), `tlumaczksef-demo-${upload ? upload.lang : lang}.pdf`);
79  setStatus("success");
80  } catch { /* fail */ }
```
Decision: `demo_email_submitted` status is keyed to the **unlock** response only (the email step). `demo_pdf_downloaded` fires only on a real PDF download (after `pdf.ok`, at `triggerDownload`).

- [ ] **Step 5.1: Write the failing test (RED).** Create `tests/components/landing/demo/download-gate.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DownloadGate } from "@/components/landing/demo/download-gate";

const captureClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  captureClient: captureClientMock,
  captureClientError: vi.fn()
}));

describe("DownloadGate analytics", () => {
  beforeEach(() => {
    captureClientMock.mockClear();
    vi.restoreAllMocks();
  });

  it("captures email submitted=success and pdf_downloaded on the happy path (sample lane)", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ downloadToken: "d" }), { status: 200 })) // unlock
      .mockResolvedValueOnce(new Response(new Blob(["%PDF"]), { status: 200 })); // pdf
    render(<DownloadGate upload={null} lang="en" open onClose={() => {}} /* + minimal props */ />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: /pobierz|download|wyślij|unlock/i }));
    await vi.waitFor(() => {
      expect(captureClientMock).toHaveBeenCalledWith(
        "demo_email_submitted",
        { status: "success", marketing_opt_in: false, lane: "sample" }
      );
      expect(captureClientMock).toHaveBeenCalledWith(
        "demo_pdf_downloaded",
        { language: "en", lane: "sample" }
      );
    });
  });

  it("captures email submitted=rate_limited and no pdf_downloaded on unlock 429", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("", { status: 429 }));
    render(<DownloadGate upload={null} lang="en" open onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: /pobierz|download|wyślij|unlock/i }));
    await vi.waitFor(() =>
      expect(captureClientMock).toHaveBeenCalledWith(
        "demo_email_submitted",
        expect.objectContaining({ status: "rate_limited" })
      )
    );
    expect(captureClientMock).not.toHaveBeenCalledWith("demo_pdf_downloaded", expect.anything());
  });
});
```
Note: confirm the real prop names for `DownloadGate` (the explore map showed `upload`, `lang`, and an `open`/visibility mechanism) and the email field + submit button accessible names; adjust regexes.

- [ ] **Step 5.2: Run it to confirm it fails (RED).**

Run: `npx vitest run tests/components/landing/demo/download-gate.test.tsx`
Expected: FAIL.

- [ ] **Step 5.3: Implement (GREEN).** In `components/landing/demo/download-gate.tsx`:

1. Import: `import { captureClient } from "@/lib/analytics/client";`
2. Add lane near the top of `submit` (or component body): `const lane = upload ? "upload" : "sample";`
3. After the unlock response is known, fire `demo_email_submitted`:
```tsx
if (unlock.status === 429) {
  captureClient("demo_email_submitted", { status: "rate_limited", marketing_opt_in: marketingOptIn, lane });
  return fail("rate_limited");
}
if (!unlock.ok) {
  captureClient("demo_email_submitted", { status: "error", marketing_opt_in: marketingOptIn, lane });
  return fail("error");
}
captureClient("demo_email_submitted", { status: "success", marketing_opt_in: marketingOptIn, lane });
const { downloadToken } = (await unlock.json()) as { downloadToken: string };
```
4. In the outer `catch` (covers a network failure at the unlock step), fire an `error` email-submitted only if we have not already emitted one. Simplest: track a boolean `emailEventSent` set true at each of the three branches above; in `catch`, `if (!emailEventSent) captureClient("demo_email_submitted", { status: "error", marketing_opt_in: marketingOptIn, lane });`
5. After `pdf.ok` (success), before/at `triggerDownload`:
```tsx
if (pdf.status === 429) return fail("rate_limited");
if (!pdf.ok) return fail("pdf_failed");
captureClient("demo_pdf_downloaded", { language: upload ? upload.lang : lang, lane });
triggerDownload(await pdf.blob(), `tlumaczksef-demo-${upload ? upload.lang : lang}.pdf`);
setStatus("success");
```

- [ ] **Step 5.4: Run it (GREEN).**

Run: `npx vitest run tests/components/landing/demo/download-gate.test.tsx`
Expected: PASS.

- [ ] **Step 5.5: Commit.**

```bash
git add components/landing/demo/download-gate.tsx tests/components/landing/demo/download-gate.test.tsx
git commit -m "feat(analytics): demo email-submit and pdf-download events"
```

---

## Phase 3: Auth completion events

### Task 6: `signup_completed` + `login_completed` (server, auth callback)

**Files:**
- Modify: `app/auth/callback/route.ts`
- Test: `tests/app/auth/callback-analytics.test.ts`

Context (current code, verbatim):
```ts
21  if (code) {
23    const { error } = await supabase.auth.exchangeCodeForSession(code);
24    if (error) { return NextResponse.redirect(.../login?error=...); }
27    return NextResponse.redirect(new URL(redirectTo, request.url));
30  if (tokenHash && rawType) {
36    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: parsedType.data });
40    if (error) { return NextResponse.redirect(.../login?error=...); }
43    return NextResponse.redirect(new URL(redirectTo, request.url));
46  return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
```
Property sources: `method` = `"google"` for the `code` branch, `"magic_link"` for the `tokenHash` branch. New-vs-existing from `data.user.created_at` (must change `{ error }` → `{ data, error }`). `signup_source` = `user.user_metadata?.source === "landing_demo" ? "landing_demo" : "direct"` (seeded by `lib/demo/send-demo-otp.ts`). `distinctId` = `user.id`.

- [ ] **Step 6.1: Write the failing test (RED).** Create `tests/app/auth/callback-analytics.test.ts`. Mirror `tests/lib/analytics/server.test.ts`: mock `@/lib/analytics/server`'s `captureServer`, mock the supabase server client, and call the route's `GET`.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const captureServerMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/server", () => ({
  captureServer: captureServerMock,
  // re-export the header constant if the route imports it from here; otherwise it's in events.ts
}));

const exchangeMock = vi.hoisted(() => vi.fn());
const verifyMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession: exchangeMock, verifyOtp: verifyMock }
  }))
}));
// Adjust the supabase factory import path to the real one used by the route.

import { GET } from "@/app/auth/callback/route";

function req(url: string) {
  return new Request(url) as unknown as import("next/server").NextRequest;
}

describe("auth callback analytics", () => {
  beforeEach(() => {
    captureServerMock.mockClear();
    exchangeMock.mockReset();
    verifyMock.mockReset();
  });

  it("captures signup_completed for a brand-new google user", async () => {
    exchangeMock.mockResolvedValue({
      data: { user: { id: "u1", created_at: new Date().toISOString(), user_metadata: {} } },
      error: null
    });
    await GET(req("https://app.test/auth/callback?code=abc"));
    expect(captureServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "u1",
        event: "signup_completed",
        properties: { method: "google", signup_source: "direct" }
      })
    );
  });

  it("captures signup_completed source=landing_demo for a new magic-link user from the demo", async () => {
    verifyMock.mockResolvedValue({
      data: { user: { id: "u2", created_at: new Date().toISOString(), user_metadata: { source: "landing_demo" } } },
      error: null
    });
    await GET(req("https://app.test/auth/callback?token_hash=h&type=email"));
    expect(captureServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "signup_completed",
        properties: { method: "magic_link", signup_source: "landing_demo" }
      })
    );
  });

  it("captures login_completed for an existing magic-link user (created long ago)", async () => {
    verifyMock.mockResolvedValue({
      data: { user: { id: "u3", created_at: "2020-01-01T00:00:00Z", user_metadata: {} } },
      error: null
    });
    await GET(req("https://app.test/auth/callback?token_hash=h&type=email"));
    expect(captureServerMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: "login_completed", properties: { method: "magic_link" } })
    );
  });

  it("does NOT capture a completion event when the exchange errors", async () => {
    exchangeMock.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    await GET(req("https://app.test/auth/callback?code=abc"));
    expect(captureServerMock).not.toHaveBeenCalled();
  });
});
```
Note: verify the exact route export (`GET`), the supabase factory module path, and the `emailOtpTypeSchema` parse behavior at execution time; adjust mocks so `verifyOtp` is reached (provide a valid `type` like `email`).

- [ ] **Step 6.2: Run it to confirm it fails (RED).**

Run: `npx vitest run tests/app/auth/callback-analytics.test.ts`
Expected: FAIL.

- [ ] **Step 6.3: Implement (GREEN).** In `app/auth/callback/route.ts`:

1. Imports:
```ts
import { captureServer } from "@/lib/analytics/server";
import type { AnalyticsEventMap } from "@/lib/analytics/events";
```
2. Add a small local helper above `GET` (or inline) to emit the right completion event from a user object:
```ts
const NEW_USER_WINDOW_MS = 5 * 60 * 1000;

function captureAuthCompletion(
  user: { id: string; created_at?: string; user_metadata?: Record<string, unknown> },
  method: "magic_link" | "google"
) {
  const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
  const isNew = createdAt > 0 && Date.now() - createdAt < NEW_USER_WINDOW_MS;
  if (isNew) {
    const source: AnalyticsEventMap["signup_completed"]["signup_source"] =
      user.user_metadata?.source === "landing_demo" ? "landing_demo" : "direct";
    captureServer({
      distinctId: user.id,
      event: "signup_completed",
      properties: { method, signup_source: source }
    });
  } else {
    captureServer({ distinctId: user.id, event: "login_completed", properties: { method } });
  }
}
```
3. In the `code` branch, capture `data` and emit on success:
```ts
const { data, error } = await supabase.auth.exchangeCodeForSession(code);
if (error) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
}
if (data.user) captureAuthCompletion(data.user, "google");
return NextResponse.redirect(new URL(redirectTo, request.url));
```
4. In the `tokenHash` branch:
```ts
const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: parsedType.data });
if (error) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
}
if (data.user) captureAuthCompletion(data.user, "magic_link");
return NextResponse.redirect(new URL(redirectTo, request.url));
```

- [ ] **Step 6.4: Run it (GREEN).**

Run: `npx vitest run tests/app/auth/callback-analytics.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6.5: Commit.**

```bash
git add app/auth/callback/route.ts tests/app/auth/callback-analytics.test.ts
git commit -m "feat(analytics): signup_completed and login_completed in auth callback"
```

### Task 7: `auth_failed` (client, login form reads `?error`)

**Files:**
- Modify: `app/login/login-form.tsx`
- Test: extend `tests/app/login/login-form.test.tsx` if it exists, else create `tests/components/auth/login-form-analytics.test.tsx`

Rationale for client-side (deviation from spec §5): the callback error path has no authenticated `distinctId` and, as a top-level redirect, no `x-posthog-session-id` header. Firing in the login form (already a client component with `captureClient`) keeps the event on the visitor's anonymous distinct id and stitches to their session. The callback already encodes the reason into `?error=`.

- [ ] **Step 7.1: Write the failing test (RED).** Render `LoginForm` with a mocked `useSearchParams` returning `error=otp_expired`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const captureClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  captureClient: captureClientMock,
  captureClientError: vi.fn()
}));
const searchParamsMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => searchParamsMock }));

import { LoginForm } from "@/app/login/login-form";

describe("LoginForm auth_failed", () => {
  beforeEach(() => captureClientMock.mockClear());

  it("captures auth_failed once when ?error is present", () => {
    searchParamsMock.get.mockReturnValue("otp_expired");
    render(<LoginForm /* minimal props */ />);
    expect(captureClientMock).toHaveBeenCalledWith("auth_failed", { reason: "otp_expired" });
  });

  it("does not capture auth_failed when no error param", () => {
    searchParamsMock.get.mockReturnValue(null);
    render(<LoginForm />);
    expect(captureClientMock).not.toHaveBeenCalledWith("auth_failed", expect.anything());
  });
});
```
Note: if `login-form.tsx` already imports `next/navigation`, align the mock with its real usage. Confirm `LoginForm`'s required props.

- [ ] **Step 7.2: Run it to confirm it fails (RED).**

Run: `npx vitest run tests/components/auth/login-form-analytics.test.tsx`
Expected: FAIL.

- [ ] **Step 7.3: Implement (GREEN).** In `app/login/login-form.tsx`:

1. Ensure imports include `useEffect` and `useSearchParams`:
```tsx
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
```
2. Inside the component, add a one-shot effect that normalizes and caps the reason (avoid high-cardinality / overlong messages):
```tsx
const searchParams = useSearchParams();
useEffect(() => {
  const raw = searchParams.get("error");
  if (!raw) return;
  const reason = raw.slice(0, 64); // Supabase auth messages are generic, not PII; cap length
  captureClient("auth_failed", { reason });
  // run once on mount for the initial error param
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 7.4: Run it (GREEN).**

Run: `npx vitest run tests/components/auth/login-form-analytics.test.tsx`
Expected: PASS.

- [ ] **Step 7.5: Commit.**

```bash
git add app/login/login-form.tsx tests/components/auth/login-form-analytics.test.tsx
git commit -m "feat(analytics): auth_failed captured client-side from login error param"
```

---

## Phase 4: Onboarding + sign-out

### Task 8: `onboarding_name_shown` + `onboarding_name_completed`

**Files:**
- Modify: `components/account/onboarding-name-modal.tsx`
- Test: `tests/components/account/onboarding-name-modal.test.tsx` (extend if present)

Context (current code, verbatim):
```tsx
9   const SEEN_KEY = "name-capture-onboarding-seen";
38  useEffect(() => {
39    if (!missing) return;
42    if (window.localStorage.getItem(SEEN_KEY)) return;
48    setOpen(true);
49  }, [missing]);
66  <NameCaptureModal ... onSaved={handleClose} ... />
```
Fire `onboarding_name_shown` at the `setOpen(true)` transition (line 48). Fire `onboarding_name_completed` from the `onSaved` callback (line 66) — wrap `handleClose` so the event fires before/with it. (Keep both events out of the shared `NameCaptureModal` so the wizard hard-block instance doesn't also emit them.)

- [ ] **Step 8.1: Write the failing test (RED).** Create/extend `tests/components/account/onboarding-name-modal.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const captureClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  captureClient: captureClientMock,
  captureClientError: vi.fn()
}));

import { OnboardingNameModal } from "@/components/account/onboarding-name-modal";

describe("OnboardingNameModal analytics", () => {
  beforeEach(() => {
    captureClientMock.mockClear();
    window.localStorage.clear();
  });

  it("captures onboarding_name_shown when the modal opens for a user missing a name", () => {
    render(<OnboardingNameModal missing /* + minimal props */ />);
    expect(captureClientMock).toHaveBeenCalledWith("onboarding_name_shown", {});
  });

  it("does not capture shown when the name is already present", () => {
    render(<OnboardingNameModal missing={false} />);
    expect(captureClientMock).not.toHaveBeenCalledWith("onboarding_name_shown", {});
  });
});
```
For `onboarding_name_completed`, add a test that invokes the `onSaved` path. The cleanest seam: assert that the prop passed to `NameCaptureModal` as `onSaved`, when called, fires the event. Mock `NameCaptureModal` to capture its `onSaved` prop and invoke it:
```tsx
const onSavedRef = vi.hoisted(() => ({ current: undefined as undefined | (() => void) }));
vi.mock("@/components/account/name-capture-modal", () => ({
  NameCaptureModal: (props: { onSaved?: () => void }) => {
    onSavedRef.current = props.onSaved;
    return null;
  }
}));
// ...in a test: render, then onSavedRef.current?.(); expect captureClient("onboarding_name_completed", {})
```

- [ ] **Step 8.2: Run it to confirm it fails (RED).**

Run: `npx vitest run tests/components/account/onboarding-name-modal.test.tsx`
Expected: FAIL.

- [ ] **Step 8.3: Implement (GREEN).** In `components/account/onboarding-name-modal.tsx`:

1. Import: `import { captureClient } from "@/lib/analytics/client";`
2. At the `setOpen(true)` transition (line 48):
```tsx
captureClient("onboarding_name_shown", {});
setOpen(true);
```
3. Wrap the `onSaved` handler so completion fires:
```tsx
const handleSaved = () => {
  captureClient("onboarding_name_completed", {});
  handleClose();
};
// ...
<NameCaptureModal ... onSaved={handleSaved} ... />
```

- [ ] **Step 8.4: Run it (GREEN).**

Run: `npx vitest run tests/components/account/onboarding-name-modal.test.tsx`
Expected: PASS.

- [ ] **Step 8.5: Commit.**

```bash
git add components/account/onboarding-name-modal.tsx tests/components/account/onboarding-name-modal.test.tsx
git commit -m "feat(analytics): onboarding name shown/completed events"
```

### Task 9: `signed_out`

**Files:**
- Modify: `components/layout/sign-out-button.tsx`
- Test: `tests/components/layout/sign-out-button.test.tsx`

Context (current code, verbatim):
```tsx
14  export function SignOutButton({ label }: { label: string }) {
16    <button type="submit" onClick={() => resetAnalyticsIdentity()}>
```
Fire `signed_out` **before** `resetAnalyticsIdentity()` (reset drops the distinct id; the event must carry identity).

- [ ] **Step 9.1: Write the failing test (RED).** Create `tests/components/layout/sign-out-button.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const captureClientMock = vi.hoisted(() => vi.fn());
const resetMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  captureClient: captureClientMock,
  captureClientError: vi.fn(),
  resetAnalyticsIdentity: resetMock
}));

import { SignOutButton } from "@/components/layout/sign-out-button";

describe("SignOutButton analytics", () => {
  beforeEach(() => {
    captureClientMock.mockClear();
    resetMock.mockClear();
  });

  it("captures signed_out before resetting identity", () => {
    render(<SignOutButton label="Wyloguj" />);
    fireEvent.click(screen.getByRole("button", { name: "Wyloguj" }));
    expect(captureClientMock).toHaveBeenCalledWith("signed_out", {});
    // ordering: signed_out captured, then reset
    const captureOrder = captureClientMock.mock.invocationCallOrder[0];
    const resetOrder = resetMock.mock.invocationCallOrder[0];
    expect(captureOrder).toBeLessThan(resetOrder);
  });
});
```

- [ ] **Step 9.2: Run it to confirm it fails (RED).**

Run: `npx vitest run tests/components/layout/sign-out-button.test.tsx`
Expected: FAIL.

- [ ] **Step 9.3: Implement (GREEN).** In `components/layout/sign-out-button.tsx` update the import and onClick:

```tsx
import { captureClient, resetAnalyticsIdentity } from "@/lib/analytics/client";
// ...
<button
  type="submit"
  onClick={() => {
    captureClient("signed_out", {});
    resetAnalyticsIdentity();
  }}
>
```

- [ ] **Step 9.4: Run it (GREEN).**

Run: `npx vitest run tests/components/layout/sign-out-button.test.tsx`
Expected: PASS.

- [ ] **Step 9.5: Commit.**

```bash
git add components/layout/sign-out-button.tsx tests/components/layout/sign-out-button.test.tsx
git commit -m "feat(analytics): signed_out event before identity reset"
```

---

## Phase 5: Landing CTA tracking

### Task 10: `TrackedCtaLink` client component

**Files:**
- Create: `components/landing/ui/tracked-cta-link.tsx`
- Test: `tests/components/landing/ui/tracked-cta-link.test.tsx`

Rationale: 4 of 6 CTA hosts are server components and cannot carry `onClick`. One small client wrapper keeps it DRY. It renders a `next/link` (preserves client nav) and fires `landing_cta_clicked` on click before navigation.

- [ ] **Step 10.1: Write the failing test (RED).** Create `tests/components/landing/ui/tracked-cta-link.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const captureClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  captureClient: captureClientMock,
  captureClientError: vi.fn()
}));
vi.mock("next/link", () => ({
  default: ({ href, onClick, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : "#"} onClick={onClick} {...rest}>{children}</a>
  )
}));

import { TrackedCtaLink } from "@/components/landing/ui/tracked-cta-link";

describe("TrackedCtaLink", () => {
  beforeEach(() => captureClientMock.mockClear());

  it("fires landing_cta_clicked with cta_id + locale on click", () => {
    render(
      <TrackedCtaLink href="/login" ctaId="nav_login" locale="pl" className="x">
        Zacznij
      </TrackedCtaLink>
    );
    fireEvent.click(screen.getByRole("link", { name: "Zacznij" }));
    expect(captureClientMock).toHaveBeenCalledWith("landing_cta_clicked", {
      cta_id: "nav_login",
      locale: "pl"
    });
  });
});
```

- [ ] **Step 10.2: Run it to confirm it fails (RED).**

Run: `npx vitest run tests/components/landing/ui/tracked-cta-link.test.tsx`
Expected: FAIL.

- [ ] **Step 10.3: Implement (GREEN).** Create `components/landing/ui/tracked-cta-link.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { captureClient } from "@/lib/analytics/client";
import type { AnalyticsEventMap } from "@/lib/analytics/events";

type CtaId = AnalyticsEventMap["landing_cta_clicked"]["cta_id"];

interface TrackedCtaLinkProps {
  href: string;
  ctaId: CtaId;
  locale: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

/**
 * Landing CTA link that records `landing_cta_clicked` before navigating.
 * Use from server components (it is a client boundary).
 */
export function TrackedCtaLink({
  href,
  ctaId,
  locale,
  className,
  children,
  onClick
}: TrackedCtaLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        captureClient("landing_cta_clicked", { cta_id: ctaId, locale });
        onClick?.();
      }}
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 10.4: Run it (GREEN).**

Run: `npx vitest run tests/components/landing/ui/tracked-cta-link.test.tsx`
Expected: PASS.

- [ ] **Step 10.5: Commit.**

```bash
git add components/landing/ui/tracked-cta-link.tsx tests/components/landing/ui/tracked-cta-link.test.tsx
git commit -m "feat(analytics): TrackedCtaLink client wrapper for landing CTAs"
```

### Task 11: Wire the 6 CTAs to `TrackedCtaLink`

**Files:**
- Modify: `components/landing/hero.tsx`, `components/landing/site-nav.tsx`, `components/landing/pricing-teaser.tsx`, `components/landing/final-cta.tsx`, `components/landing/mobile-nav-sheet.tsx`

This task is mechanical replacement; verify each markup against the explore map at execution. There is no unit test per host (covered by Task 10 + an E2E smoke in Task 13); keep the visual markup identical (same className strings).

- [ ] **Step 11.1: Hero CTAs.** In `components/landing/hero.tsx`, replace the two `<Button href="#demo" ...>` (lines 29–30) with `TrackedCtaLink` carrying `ctaId="hero_primary"` / `"hero_secondary"` and `locale={locale}`. Reuse the Button's classes via `className`. Example:
```tsx
import { TrackedCtaLink } from "@/components/landing/ui/tracked-cta-link";
// ...
<TrackedCtaLink href="#demo" ctaId="hero_primary" locale={locale} className={/* primary button classes */}>
  {t.ctaPrimary}
</TrackedCtaLink>
<TrackedCtaLink href="#demo" ctaId="hero_secondary" locale={locale} className={/* ghost button classes */}>
  {t.ctaSecondary}
</TrackedCtaLink>
```
If lifting the `Button` classes is awkward, keep `<Button>` for styling and wrap differently — but the simplest stable approach is to copy the class strings. Confirm classes from `components/landing/ui/button.tsx`.

- [ ] **Step 11.2: Nav login CTA.** In `components/landing/site-nav.tsx` (line 26-28) replace the `<Link href="/login" ...>` with `<TrackedCtaLink href="/login" ctaId="nav_login" locale={locale} className={/* same classes */}>{t.cta}</TrackedCtaLink>`.

- [ ] **Step 11.3: Pricing teaser CTA.** In `components/landing/pricing-teaser.tsx` (line 62) replace `<Button href={t.ctaHref} ...>` with `<TrackedCtaLink href={t.ctaHref} ctaId="pricing_teaser" locale={locale} className={/* ghost classes */}>{t.cta}</TrackedCtaLink>`.

- [ ] **Step 11.4: Final CTA.** In `components/landing/final-cta.tsx` (line 21-26) replace `<Link href="/login" ...>` with `<TrackedCtaLink href="/login" ctaId="final_cta" locale={locale} className={/* same classes */}>{t.cta}</TrackedCtaLink>`.

- [ ] **Step 11.5: Mobile nav CTA.** `components/landing/mobile-nav-sheet.tsx` is already a client component but does not receive `locale`. Thread `locale` through `MobileNavSheetProps` (add `locale: LandingLocale`) and pass it from `site-nav.tsx` (where `<MobileNavSheet ... />` is rendered, ~lines 31-37). Then in the sheet's CTA `<Link href={ctaHref} onClick={() => setOpen(false)} ...>` (line 88-94) add the capture:
```tsx
onClick={() => {
  captureClient("landing_cta_clicked", { cta_id: "mobile_nav", locale });
  setOpen(false);
}}
```
Add `import { captureClient } from "@/lib/analytics/client";` to the sheet.

- [ ] **Step 11.6: Typecheck + full demo/landing tests + build.**

Run: `npx tsc --noEmit && npx vitest run tests/components/landing && npm run build`
Expected: PASS / build succeeds (catches any server/client boundary error from the CTA changes).

- [ ] **Step 11.7: Commit.**

```bash
git add components/landing/hero.tsx components/landing/site-nav.tsx components/landing/pricing-teaser.tsx components/landing/final-cta.tsx components/landing/mobile-nav-sheet.tsx
git commit -m "feat(analytics): track landing CTA clicks across hero, nav, pricing, final, mobile"
```

---

## Phase 6: Docs + full verification

### Task 12: Update `docs/analytics.md`

**Files:**
- Modify: `docs/analytics.md`

- [ ] **Step 12.1: Add the 14 new events to the §4 event-catalog table** (columns `Event | Properties | Where it fires | Source`), grouped under "Demo funnel", "Auth/onboarding", "Landing". Use the exact file paths from this plan.

- [ ] **Step 12.2: Update the dashboards section** to describe the three new themed dashboards (built in Task 14) and note the two spec deviations (`auth_failed` client-side; `landing_cta_clicked` via `TrackedCtaLink`). Cross-link the spec PR2.

- [ ] **Step 12.3: Commit.**

```bash
git add docs/analytics.md
git commit -m "docs(analytics): document PR2 acquisition events and dashboards"
```

### Task 13: Full suite + E2E smoke + coverage gate

- [ ] **Step 13.1: Run the full unit suite and typecheck.**

Run: `npx tsc --noEmit && npm test`
Expected: PASS, ≥80% coverage on changed files (per repo policy). Add focused tests if any new branch is uncovered.

- [ ] **Step 13.2: Demo E2E smoke (optional but recommended).** If an existing Playwright demo test exists (search `tests/e2e` for demo), extend it to intercept `/ingest` and assert the demo event names appear (mirror the PR1 e2e that asserts `/ingest` requests). Do not assert on PII.

Run: `npm run test:e2e -- <demo-spec>`
Expected: PASS.

- [ ] **Step 13.3: Push branch and open PR.**

```bash
git push -u origin claude/posthog-acquisition-funnel
gh pr create --base main --title "feat(analytics): acquisition funnel events (demo, auth, onboarding, CTA)" --body "<summary + test plan>"
```

---

## Phase 7: PostHog dashboards (via MCP, after merge/deploy)

> These steps use the PostHog MCP (`mcp__posthog__exec`). Run `info <tool>` before each `call`. New event names can be referenced in insights before data arrives; insights populate once the PR is deployed and events fire. Project 199578 (EU). Keep the existing wizard dashboard 740875 as-is.

### Task 14: Build three themed dashboards

- [ ] **Step 14.1: Verify the new events are arriving** (after deploy). `call read-data-schema {"query":{"kind":"events"}}` and confirm `demo_language_selected`, `demo_file_uploaded`, `signup_completed`, `landing_cta_clicked`, etc. are present. If after 24h some are still absent, investigate the firing site (this also covers the user's "email login not showing" concern — confirm `login_submitted`/`login_completed` are now arriving).

- [ ] **Step 14.2: Create dashboard "Acquisition / Demo".** `dashboard-create`, then add insights:
  - **Demo funnel** (`query-funnel`, 1-day conversion window, ordered): `$pageview` (path `/` or `/en`) → `demo_language_selected` OR `demo_file_uploaded` → `demo_download_gate_opened` → `demo_email_submitted` (status=success) → `demo_pdf_downloaded`.
  - **Landing CTA clicks** (`query-trends`, breakdown by `cta_id`).
  - **Demo upload quality** (`query-trends`): `demo_file_uploaded` broken down by `status`; `demo_translation_failed` broken down by `error_code`.

- [ ] **Step 14.3: Create dashboard "Activation".** `dashboard-create`, then:
  - **Signup→activation funnel** (`query-funnel`, 7-day window): `signup_completed` → `onboarding_name_completed` → `translation_started` → `invoice_translated` → `pdf_downloaded`.
  - **Signups by method/source** (`query-trends`): `signup_completed` broken down by `method`, and a second tile by `signup_source`.
  - **Login mix** (`query-trends`): `login_completed` by `method` + `google_signin_clicked` + `login_submitted` (verifies email-login is firing).

- [ ] **Step 14.4: Create dashboard "Quality & Engagement".** `dashboard-create`, then:
  - **Auth failures** (`query-trends`): `auth_failed` by `reason`.
  - **Demo vs failed translations** (`query-trends`): `demo_translation_completed` vs `demo_translation_failed`.
  - **Weekly retention** (`query-retention`) on `invoice_translated`.

- [ ] **Step 14.5: Record dashboard URLs in `docs/analytics.md`** and surface them to the user. Commit the doc update (if on a follow-up branch, otherwise note links in the PR).

---

## Self-review checklist (run before handing off)

- **Spec coverage:** demo events (spec §5 demo table) ✅ Task 3–5; auth/onboarding (spec §5 auth table) ✅ Task 6–9; landing CTA ✅ Task 10–11; dashboards demo+activation (spec §7.1–7.2) ✅ Task 14; quality/engagement (spec §7.4–7.5) ✅ Task 14.4. Deferred & noted: `contact_form_submitted`, PR3 depth, paywall dashboard (§7.3).
- **Placeholder scan:** every code step shows real code; test steps show real assertions. Line numbers are flagged as "confirm at execution" where they may shift.
- **Type consistency:** event names and property shapes in Tasks 3–11 exactly match the `AnalyticsEventMap` added in Task 1 (`lane: "sample"|"upload"`, `status` enums, `cta_id` union, `method`/`signup_source` enums). `captureClient`/`captureServer` signatures match the wrappers from the explore map.
- **Known risk:** Task 11 changes server→client boundaries on landing CTAs; Step 11.6 `npm run build` guards against RSC serialization errors.
