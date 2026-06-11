# PostHog Analytics PR 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the PostHog wizard baseline (commit `e69fed4`) into a GDPR-correct, typed, reliable analytics foundation: cookieless-until-consent capture, single identity per user, a typed event catalog, durable server-side captures, consent UI, and privacy-policy disclosure.

**Architecture:** `posthog-js` initialized in `instrumentation-client.ts` (memory persistence, no autocapture) captures client funnel events through the `/ingest` reverse proxy; a `posthog-node` singleton behind `lib/analytics/server.ts` captures authoritative events in API routes via `after()` + flush. All events flow through a typed catalog in `lib/analytics/events.ts`. Spec: `docs/superpowers/specs/2026-06-11-posthog-analytics-design.md`.

**Tech Stack:** Next.js 15.3 App Router, posthog-js 1.386, posthog-node 5.36, vitest + @testing-library/react, Playwright.

**Branch:** `claude/posthog-analytics` (already exists, off `main`, wizard baseline + spec committed).

**Conventions for every task:** run commands from the repo root of the worktree. The vitest alias `@/` maps to the repo root. Never call `posthog.capture` with a raw string outside `lib/analytics/`. No em/en dashes in any user-facing copy. Follow-up plans for PR 2 (acquisition funnel) and PR 3 (product depth) will be written after this PR merges; their event lists are pinned in spec §5.

---

### Task 1: Typed event catalog

**Files:**
- Create: `lib/analytics/events.ts`
- Test: `tests/lib/analytics/events.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/analytics/events.test.ts
import { describe, expect, it } from "vitest";
import { EVENT_PROPERTY_KEYS } from "@/lib/analytics/events";

// Spec §4 PII rules: invoice content must never enter event properties.
const FORBIDDEN_KEY_PATTERNS = [
  /nip/i,
  /vat_id/i,
  /iban/i,
  /swift/i,
  /file_?name/i,
  /party/i,
  /buyer/i,
  /seller/i,
  /invoice_number/i,
  /email/i,
  /first_name/i,
  /last_name/i,
  /display_name/i,
  /address/i
];

describe("analytics event catalog", () => {
  it("defines the 14 wizard baseline events", () => {
    expect(Object.keys(EVENT_PROPERTY_KEYS).sort()).toEqual(
      [
        "checkout_initiated",
        "checkout_session_created",
        "files_uploaded",
        "google_signin_clicked",
        "invoice_translated",
        "login_email_sent",
        "login_submitted",
        "payment_completed",
        "payment_failed",
        "payment_refunded",
        "pdf_downloaded",
        "translation_batch_cancelled",
        "translation_started",
        "zip_downloaded"
      ].sort()
    );
  });

  it("contains no forbidden PII property keys", () => {
    for (const [event, keys] of Object.entries(EVENT_PROPERTY_KEYS)) {
      for (const key of keys) {
        for (const pattern of FORBIDDEN_KEY_PATTERNS) {
          expect(
            pattern.test(key),
            `${event}.${key} matches forbidden pattern ${pattern}`
          ).toBe(false);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/analytics/events.test.ts`
Expected: FAIL, cannot resolve `@/lib/analytics/events`.

- [ ] **Step 3: Write the catalog**

```ts
// lib/analytics/events.ts
/**
 * Single source of truth for every PostHog event this app emits.
 *
 * PII rules (spec §4, hard constraints):
 * - Never capture invoice content: file names, party names, NIP/VAT ids,
 *   IBAN/SWIFT, invoice numbers, invoice amounts, emails.
 * - Allowed: counts, byte sizes, language codes, booleans, error codes,
 *   durations, credit package sizes and package prices, internal UUIDs
 *   (invoice_id, user id) and Stripe ids.
 *
 * Adding an event: extend AnalyticsEventMap AND EVENT_PROPERTY_KEYS.
 * The `satisfies` clause keeps the two in sync at compile time; the PII
 * test in tests/lib/analytics/events.test.ts vets the property names.
 */

export interface AnalyticsEventMap {
  login_submitted: { method: "email_otp" };
  google_signin_clicked: Record<string, never>;
  login_email_sent: { method: "email_otp" };
  files_uploaded: {
    file_count: number;
    success_count: number;
    failure_count: number;
  };
  translation_started: {
    file_count: number;
    language: string;
    bilingual: boolean;
  };
  translation_batch_cancelled: { total: number; done: number };
  pdf_downloaded: {
    invoice_id: string;
    language: string;
    bilingual: boolean;
    context: "single" | "batch_row";
  };
  zip_downloaded: {
    invoice_count: number;
    language: string;
    bilingual: boolean;
  };
  checkout_initiated: { package_size: number; total_net_pln?: number };
  checkout_session_created: {
    package_size: number;
    total_amount_cents: number;
    currency: string;
    stripe_session_id: string;
  };
  payment_completed: {
    package_size: number;
    total_amount_cents: number;
    currency: string;
    stripe_session_id: string;
  };
  payment_failed: { stripe_session_id: string; purchase_id: string };
  payment_refunded: { package_size: number; stripe_charge_id: string };
  invoice_translated: {
    invoice_id: string;
    language: string;
    bilingual: boolean;
    cache_hit: boolean;
    used_ai: boolean;
    duration_ms: number;
  };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

export const EVENT_PROPERTY_KEYS = {
  login_submitted: ["method"],
  google_signin_clicked: [],
  login_email_sent: ["method"],
  files_uploaded: ["file_count", "success_count", "failure_count"],
  translation_started: ["file_count", "language", "bilingual"],
  translation_batch_cancelled: ["total", "done"],
  pdf_downloaded: ["invoice_id", "language", "bilingual", "context"],
  zip_downloaded: ["invoice_count", "language", "bilingual"],
  checkout_initiated: ["package_size", "total_net_pln"],
  checkout_session_created: [
    "package_size",
    "total_amount_cents",
    "currency",
    "stripe_session_id"
  ],
  payment_completed: [
    "package_size",
    "total_amount_cents",
    "currency",
    "stripe_session_id"
  ],
  payment_failed: ["stripe_session_id", "purchase_id"],
  payment_refunded: ["package_size", "stripe_charge_id"],
  invoice_translated: [
    "invoice_id",
    "language",
    "bilingual",
    "cache_hit",
    "used_ai",
    "duration_ms"
  ]
} as const satisfies {
  [K in AnalyticsEventName]: readonly (keyof AnalyticsEventMap[K] & string)[];
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/analytics/events.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/analytics/events.ts tests/lib/analytics/events.test.ts
git commit -m "feat(analytics): add typed event catalog with PII guard"
```

---

### Task 2: Consent module (pure logic)

**Files:**
- Create: `lib/analytics/consent.ts`
- Test: `tests/lib/analytics/consent.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/analytics/consent.test.ts
import { describe, expect, it } from "vitest";
import {
  CONSENT_REPROMPT_DAYS,
  CONSENT_STORAGE_KEY,
  persistenceFor,
  readConsentChoice,
  shouldShowConsentPrompt,
  storeConsentChoice
} from "@/lib/analytics/consent";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    }
  };
}

const NOW = new Date("2026-06-11T12:00:00.000Z");

describe("consent storage", () => {
  it("round-trips a stored choice", () => {
    const storage = memoryStorage();
    const stored = storeConsentChoice(storage, "accepted", NOW);
    expect(stored).toEqual({ value: "accepted", at: NOW.toISOString() });
    expect(readConsentChoice(storage)).toEqual(stored);
  });

  it("returns null for missing or corrupted values", () => {
    expect(readConsentChoice(memoryStorage())).toBeNull();
    expect(
      readConsentChoice(memoryStorage({ [CONSENT_STORAGE_KEY]: "not json" }))
    ).toBeNull();
    expect(
      readConsentChoice(
        memoryStorage({ [CONSENT_STORAGE_KEY]: JSON.stringify({ value: "??" }) })
      )
    ).toBeNull();
  });
});

describe("shouldShowConsentPrompt", () => {
  it("shows when there is no stored choice", () => {
    expect(shouldShowConsentPrompt(null, NOW)).toBe(true);
  });

  it("hides forever after accept", () => {
    expect(
      shouldShowConsentPrompt({ value: "accepted", at: "2025-01-01T00:00:00.000Z" }, NOW)
    ).toBe(false);
  });

  it("hides a recent decline but re-asks after the re-prompt window", () => {
    expect(
      shouldShowConsentPrompt({ value: "declined", at: "2026-06-01T00:00:00.000Z" }, NOW)
    ).toBe(false);
    const old = new Date(
      NOW.getTime() - (CONSENT_REPROMPT_DAYS + 1) * 86_400_000
    ).toISOString();
    expect(shouldShowConsentPrompt({ value: "declined", at: old }, NOW)).toBe(true);
  });
});

describe("persistenceFor", () => {
  it("uses cookieless memory persistence unless consent was accepted", () => {
    expect(persistenceFor(null)).toBe("memory");
    expect(persistenceFor({ value: "declined", at: NOW.toISOString() })).toBe("memory");
    expect(persistenceFor({ value: "accepted", at: NOW.toISOString() })).toBe(
      "localStorage+cookie"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/analytics/consent.test.ts`
Expected: FAIL, cannot resolve `@/lib/analytics/consent`.

- [ ] **Step 3: Implement the module**

```ts
// lib/analytics/consent.ts
/**
 * Cookie-consent state for analytics (spec §2, §6).
 *
 * Anonymous visitors run cookieless (memory persistence). Accepting the
 * consent prompt upgrades PostHog to localStorage+cookie persistence.
 * The stored choice itself is functional storage and needs no consent.
 */

export const CONSENT_STORAGE_KEY = "ksef-analytics-consent";
export const CONSENT_REPROMPT_DAYS = 180;

export type ConsentValue = "accepted" | "declined";

export interface ConsentChoice {
  value: ConsentValue;
  at: string; // ISO timestamp of the decision
}

export type AnalyticsPersistence = "memory" | "localStorage+cookie";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readConsentChoice(storage: StorageLike): ConsentChoice | null {
  const raw = storage.getItem(CONSENT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "value" in parsed &&
      "at" in parsed &&
      (parsed.value === "accepted" || parsed.value === "declined") &&
      typeof (parsed as { at: unknown }).at === "string"
    ) {
      return { value: parsed.value, at: (parsed as { at: string }).at };
    }
    return null;
  } catch {
    return null;
  }
}

export function storeConsentChoice(
  storage: StorageLike,
  value: ConsentValue,
  now: Date
): ConsentChoice {
  const choice: ConsentChoice = { value, at: now.toISOString() };
  storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(choice));
  return choice;
}

export function shouldShowConsentPrompt(
  choice: ConsentChoice | null,
  now: Date
): boolean {
  if (!choice) return true;
  if (choice.value === "accepted") return false;
  const decidedAt = new Date(choice.at).getTime();
  if (Number.isNaN(decidedAt)) return true;
  const ageDays = (now.getTime() - decidedAt) / 86_400_000;
  return ageDays > CONSENT_REPROMPT_DAYS;
}

export function persistenceFor(choice: ConsentChoice | null): AnalyticsPersistence {
  return choice?.value === "accepted" ? "localStorage+cookie" : "memory";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/analytics/consent.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/analytics/consent.ts tests/lib/analytics/consent.test.ts
git commit -m "feat(analytics): add consent state module"
```

---

### Task 3: Client capture wrapper

**Files:**
- Create: `lib/analytics/client.ts`
- Test: `tests/lib/analytics/client.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/analytics/client.test.ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above const declarations; vi.hoisted avoids the TDZ error.
const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
  captureException: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  set_config: vi.fn(),
  get_distinct_id: vi.fn(() => "anon-123"),
  get_session_id: vi.fn(() => "sess-1")
}));

vi.mock("posthog-js", () => ({ default: posthogMock }));

import {
  captureClient,
  captureClientError,
  getAnalyticsSessionId,
  identifyAuthenticatedUser,
  resetAnalyticsIdentity
} from "@/lib/analytics/client";
import { CONSENT_STORAGE_KEY } from "@/lib/analytics/consent";

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  posthogMock.get_distinct_id.mockReturnValue("anon-123");
});

describe("captureClient", () => {
  it("forwards typed events to posthog", () => {
    captureClient("login_submitted", { method: "email_otp" });
    expect(posthogMock.capture).toHaveBeenCalledWith("login_submitted", {
      method: "email_otp"
    });
  });
});

describe("captureClientError", () => {
  it("forwards errors to posthog", () => {
    const err = new Error("boom");
    captureClientError(err);
    expect(posthogMock.captureException).toHaveBeenCalledWith(err);
  });
});

describe("identifyAuthenticatedUser", () => {
  it("upgrades persistence and identifies by user id", () => {
    identifyAuthenticatedUser("user-1", { email: "a@b.pl", locale: "pl" });
    expect(posthogMock.set_config).toHaveBeenCalledWith({
      persistence: "localStorage+cookie"
    });
    expect(posthogMock.identify).toHaveBeenCalledWith("user-1", {
      email: "a@b.pl",
      locale: "pl"
    });
  });

  it("does nothing when the user is already identified", () => {
    posthogMock.get_distinct_id.mockReturnValue("user-1");
    identifyAuthenticatedUser("user-1", { email: "a@b.pl", locale: "pl" });
    expect(posthogMock.identify).not.toHaveBeenCalled();
    expect(posthogMock.set_config).not.toHaveBeenCalled();
  });
});

describe("resetAnalyticsIdentity", () => {
  it("resets and returns to memory persistence without accepted consent", () => {
    resetAnalyticsIdentity();
    expect(posthogMock.reset).toHaveBeenCalled();
    expect(posthogMock.set_config).toHaveBeenCalledWith({ persistence: "memory" });
  });

  it("keeps cookie persistence when consent was accepted", () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ value: "accepted", at: "2026-06-01T00:00:00.000Z" })
    );
    resetAnalyticsIdentity();
    expect(posthogMock.set_config).toHaveBeenCalledWith({
      persistence: "localStorage+cookie"
    });
  });
});

describe("getAnalyticsSessionId", () => {
  it("returns the posthog session id", () => {
    expect(getAnalyticsSessionId()).toBe("sess-1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/analytics/client.test.ts`
Expected: FAIL, cannot resolve `@/lib/analytics/client`.

- [ ] **Step 3: Implement the wrapper**

```ts
// lib/analytics/client.ts
/**
 * Browser-side analytics API. The only module allowed to talk to posthog-js
 * outside instrumentation-client.ts. Import from client components only.
 */
import posthog from "posthog-js";
import type { AnalyticsEventMap, AnalyticsEventName } from "./events";
import { persistenceFor, readConsentChoice } from "./consent";

export function captureClient<E extends AnalyticsEventName>(
  event: E,
  properties: AnalyticsEventMap[E]
): void {
  if (typeof window === "undefined") return;
  posthog.capture(event, properties);
}

export function captureClientError(error: unknown): void {
  if (typeof window === "undefined") return;
  posthog.captureException(error);
}

/**
 * Identify a logged-in user by Supabase user id (spec §4). Logged-in users
 * get cookie persistence under legitimate interest, disclosed in the
 * privacy policy. Safe to call on every render of the protected layout;
 * re-identification is skipped when the distinct id already matches.
 */
export function identifyAuthenticatedUser(
  userId: string,
  props: { email?: string; locale?: string }
): void {
  if (typeof window === "undefined") return;
  if (posthog.get_distinct_id() === userId) return;
  posthog.set_config({ persistence: "localStorage+cookie" });
  posthog.identify(userId, props);
}

/** Call on sign-out: unlink the person and drop back to the consent-derived persistence. */
export function resetAnalyticsIdentity(): void {
  if (typeof window === "undefined") return;
  posthog.reset();
  posthog.set_config({
    persistence: persistenceFor(readConsentChoice(window.localStorage))
  });
}

/** Session id for stitching client sessions onto server-side captures. */
export function getAnalyticsSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return posthog.get_session_id();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/analytics/client.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/analytics/client.ts tests/lib/analytics/client.test.ts
git commit -m "feat(analytics): add typed client capture wrapper"
```

---

### Task 4: Server capture wrapper with after() flush

**Files:**
- Create: `lib/analytics/server.ts`
- Test: `tests/lib/analytics/server.test.ts`
- Delete (in Task 6): `lib/posthog-server.ts` stays until call sites migrate.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/analytics/server.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

// vi.hoisted so the hoisted vi.mock factories can reference these safely.
const { captureMock, flushMock, afterCallbacks } = vi.hoisted(() => ({
  captureMock: vi.fn(),
  flushMock: vi.fn().mockResolvedValue(undefined),
  afterCallbacks: [] as Array<() => Promise<void> | void>
}));

vi.mock("next/server", () => ({
  after: (cb: () => Promise<void> | void) => {
    afterCallbacks.push(cb);
  }
}));

vi.mock("posthog-node", () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: captureMock,
    flush: flushMock
  }))
}));

async function importFreshModule() {
  vi.resetModules();
  return import("@/lib/analytics/server");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  afterCallbacks.length = 0;
});

describe("captureServer", () => {
  it("defers capture + flush to after() and stitches $session_id", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    const { captureServer } = await importFreshModule();

    captureServer({
      distinctId: "user-1",
      event: "payment_completed",
      properties: {
        package_size: 10,
        total_amount_cents: 5990,
        currency: "pln",
        stripe_session_id: "cs_1"
      },
      sessionId: "sess-1"
    });

    expect(captureMock).not.toHaveBeenCalled(); // deferred, not inline
    for (const cb of afterCallbacks) await cb();

    expect(captureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "payment_completed",
      properties: {
        package_size: 10,
        total_amount_cents: 5990,
        currency: "pln",
        stripe_session_id: "cs_1",
        $session_id: "sess-1"
      }
    });
    expect(flushMock).toHaveBeenCalled();
  });

  it("omits $session_id when no session is provided", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    const { captureServer } = await importFreshModule();

    captureServer({
      distinctId: "user-1",
      event: "payment_failed",
      properties: { stripe_session_id: "cs_1", purchase_id: "p_1" }
    });
    for (const cb of afterCallbacks) await cb();

    const props = captureMock.mock.calls[0][0].properties;
    expect(props).not.toHaveProperty("$session_id");
  });

  it("skips capture without throwing when env vars are missing", async () => {
    // Explicitly blank the vars: the shell or .env.test may carry real values.
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { captureServer } = await importFreshModule();

    expect(() =>
      captureServer({
        distinctId: "user-1",
        event: "payment_failed",
        properties: { stripe_session_id: "cs_1", purchase_id: "p_1" }
      })
    ).not.toThrow();
    expect(afterCallbacks).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/analytics/server.test.ts`
Expected: FAIL, cannot resolve `@/lib/analytics/server`.

- [ ] **Step 3: Implement the wrapper**

```ts
// lib/analytics/server.ts
/**
 * Server-side analytics API (route handlers and server actions only).
 *
 * Captures are deferred with after() so they never delay the response, and
 * flushed inside the callback so events are not lost when the serverless
 * function freezes (the wizard baseline fired-and-forgot). Analytics must
 * never break a request: failures are logged and swallowed.
 */
import { after } from "next/server";
import { PostHog } from "posthog-node";
import type { AnalyticsEventMap, AnalyticsEventName } from "./events";

let client: PostHog | null = null;

function getPostHogServerClient(): PostHog {
  if (!client) {
    const key = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key || !host) {
      throw new Error(
        "PostHog server capture requires NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN and NEXT_PUBLIC_POSTHOG_HOST"
      );
    }
    client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  }
  return client;
}

export interface ServerCaptureArgs<E extends AnalyticsEventName> {
  distinctId: string;
  event: E;
  properties: AnalyticsEventMap[E];
  /** posthog-js session id forwarded by the client (X-POSTHOG-SESSION-ID). */
  sessionId?: string;
}

export function captureServer<E extends AnalyticsEventName>(
  args: ServerCaptureArgs<E>
): void {
  let posthog: PostHog;
  try {
    posthog = getPostHogServerClient();
  } catch (error) {
    console.error("[analytics] server capture skipped:", error);
    return;
  }

  const properties = args.sessionId
    ? { ...args.properties, $session_id: args.sessionId }
    : { ...args.properties };

  after(async () => {
    try {
      posthog.capture({
        distinctId: args.distinctId,
        event: args.event,
        properties
      });
      await posthog.flush();
    } catch (error) {
      console.error(`[analytics] failed to flush ${args.event}:`, error);
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/analytics/server.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/analytics/server.ts tests/lib/analytics/server.test.ts
git commit -m "feat(analytics): add server capture wrapper with after() flush"
```

---

### Task 5: Migrate client call sites, fix the identify(email) bug

**Files:**
- Modify: `app/login/login-form.tsx`
- Modify: `components/billing/credit-slider.tsx`
- Modify: `components/translate/delivery-step.tsx`
- Modify: `components/translate/use-translation-wizard.ts`
- Test: extend `tests/components/translate/delivery-step.test.tsx`

- [ ] **Step 1: login-form.tsx — replace raw posthog with the wrapper and DELETE the pre-auth identify**

Replace `import posthog from "posthog-js";` with:

```ts
import { captureClient, captureClientError } from "@/lib/analytics/client";
```

Then apply these call replacements:

| Old | New |
|---|---|
| `posthog.capture("google_signin_clicked");` | `captureClient("google_signin_clicked", {});` |
| `posthog.capture("login_submitted", { method: "email_otp" });` | `captureClient("login_submitted", { method: "email_otp" });` |
| `posthog.capture("login_email_sent", { method: "email_otp" });` | `captureClient("login_email_sent", { method: "email_otp" });` |
| `posthog.identify(currentEmail, { email: currentEmail });` | **delete this line entirely** (spec §4 identity bug) |
| `posthog.captureException(error);` / `posthog.captureException(err);` (3 sites) | `captureClientError(error);` / `captureClientError(err);` |

- [ ] **Step 2: credit-slider.tsx — same pattern**

Replace `import posthog from "posthog-js";` with `import { captureClient, captureClientError } from "@/lib/analytics/client";`, then:

```ts
// in onContinue(), replacing the posthog.capture call:
captureClient("checkout_initiated", {
  package_size: size,
  total_net_pln: quote ? quote.totalAmountCents / 100 : undefined
});
// in the catch block, replacing posthog.captureException(e):
captureClientError(e);
```

- [ ] **Step 3: delivery-step.tsx — wrapper + the new `context` property**

Replace `import posthog from "posthog-js";` with `import { captureClient } from "@/lib/analytics/client";`, then:

```ts
// In DeliverySingle's download callback:
captureClient("pdf_downloaded", {
  invoice_id: item.invoiceId,
  language,
  bilingual,
  context: "single"
});

// In DeliveryBatch's per-row download callback:
captureClient("pdf_downloaded", {
  invoice_id: it.invoiceId,
  language,
  bilingual,
  context: "batch_row"
});

// In DeliveryBatch's ZIP callback:
captureClient("zip_downloaded", {
  invoice_count: ids.length,
  language,
  bilingual
});
```

- [ ] **Step 4: use-translation-wizard.ts — wrapper**

Replace `import posthog from "posthog-js";` with `import { captureClient, captureClientError } from "@/lib/analytics/client";`, then:

```ts
// files_uploaded (in addFiles, after the upload loop):
captureClient("files_uploaded", {
  file_count: unique.length,
  success_count: successCount,
  failure_count: failureCount
});

// translation_started (in startTranslation):
captureClient("translation_started", {
  file_count: items.length,
  language: current.language,
  bilingual: current.bilingual
});

// translation_batch_cancelled (in cancelBatch):
captureClient("translation_batch_cancelled", {
  total: jobItemsRef.current.length,
  done: jobItemsRef.current.filter((j) => j.status === "done").length
});

// the posthog.captureException(error) in the batch error path:
captureClientError(error);
```

- [ ] **Step 5: Add a capture assertion to the delivery-step test**

At the top of `tests/components/translate/delivery-step.test.tsx`, add (alongside existing imports and mocks):

```ts
import { vi } from "vitest";

const captureClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  captureClient: captureClientMock,
  captureClientError: vi.fn()
}));
```

Add one test inside the existing describe block for the single-invoice download path (reuse the file's existing render helpers and props; the existing download test shows how the download button is clicked):

```ts
it("captures pdf_downloaded with context single on download", async () => {
  // arrange + click the download button exactly as the existing
  // "downloads the PDF" test in this file does
  // then:
  expect(captureClientMock).toHaveBeenCalledWith(
    "pdf_downloaded",
    expect.objectContaining({ context: "single" })
  );
});
```

- [ ] **Step 6: Run the affected test files**

Run: `npx vitest run tests/components/translate tests/lib/analytics`
Expected: PASS, including the new assertion.

- [ ] **Step 7: Typecheck and commit**

```bash
npm run typecheck
git add app/login/login-form.tsx components/billing/credit-slider.tsx \
  components/translate/delivery-step.tsx components/translate/use-translation-wizard.ts \
  tests/components/translate/delivery-step.test.tsx
git commit -m "fix(analytics): route client events through typed wrapper, drop pre-auth identify"
```

---

### Task 6: Migrate server call sites, add session stitching, delete lib/posthog-server.ts

**Files:**
- Modify: `app/api/stripe/webhook/route.ts` (3 capture sites)
- Modify: `app/api/stripe/checkout/route.ts` (1 site)
- Modify: `app/api/translate/route.ts` (1 site)
- Modify: `components/translate/default-wizard-api.ts` (send session header)
- Delete: `lib/posthog-server.ts`

- [ ] **Step 1: webhook route — swap to captureServer**

Replace `import { getPostHogClient } from "@/lib/posthog-server";` with `import { captureServer } from "@/lib/analytics/server";`. Then replace each `getPostHogClient().capture({ distinctId: ..., event: "X", properties: {...} })` block with the equivalent `captureServer({ distinctId: ..., event: "X", properties: {...} })` call, keeping the existing properties verbatim:

```ts
// payment_completed (in handleCheckoutCompleted):
captureServer({
  distinctId: purchase.data.user_id,
  event: "payment_completed",
  properties: {
    package_size: purchase.data.package_size,
    total_amount_cents: purchase.data.total_amount_cents,
    currency: purchase.data.currency,
    stripe_session_id: session.id
  }
});

// payment_failed (in handleAsyncPaymentFailed):
captureServer({
  distinctId: purchase.data.user_id,
  event: "payment_failed",
  properties: { stripe_session_id: session.id, purchase_id: purchase.data.id }
});

// payment_refunded (in handleChargeRefunded):
captureServer({
  distinctId: purchase.data.user_id,
  event: "payment_refunded",
  properties: {
    package_size: purchase.data.package_size,
    stripe_charge_id: charge.id
  }
});
```

- [ ] **Step 2: checkout route — same swap**

```ts
import { captureServer } from "@/lib/analytics/server";

// replacing the getPostHogClient().capture block:
captureServer({
  distinctId: userData.user.id,
  event: "checkout_session_created",
  properties: {
    package_size: packageSize,
    total_amount_cents: quote.totalAmountCents,
    currency: quote.currency,
    stripe_session_id: session.id
  }
});
```

- [ ] **Step 3: translate route — swap + session stitching**

Replace the import as above. In the POST handler, the wizard's capture sits inside `translateCached(params)`, which does not see the request. Read the header in the POST handler and pass it through to `translateCached` as an extra optional argument `posthogSessionId?: string`:

```ts
// in the POST handler, before calling translateCached:
const posthogSessionId =
  request.headers.get("x-posthog-session-id") ?? undefined;

// translateCached signature gains the optional param, and its capture becomes:
captureServer({
  distinctId: userData.user.id,
  event: "invoice_translated",
  properties: {
    invoice_id: params.invoiceId,
    language: params.language,
    bilingual: params.bilingual !== false,
    cache_hit: result.cached,
    used_ai: result.usedAi,
    duration_ms: timings.totalMs
  },
  sessionId: posthogSessionId
});
```

- [ ] **Step 4: default-wizard-api.ts — send the header**

Add the import and extend the `/api/translate` fetch headers (currently `headers: { "Content-Type": "application/json" }` in the `translate` method around line 89):

```ts
import { getAnalyticsSessionId } from "@/lib/analytics/client";

// inside translate(), build headers so undefined session ids are omitted:
const sessionId = getAnalyticsSessionId();
const res = await fetch("/api/translate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(sessionId ? { "X-POSTHOG-SESSION-ID": sessionId } : {})
  },
  body: JSON.stringify(/* unchanged existing body */)
});
```

- [ ] **Step 5: Delete the wizard's singleton**

```bash
git rm lib/posthog-server.ts
```

Run: `grep -rn "posthog-server" app lib components` — expected: no matches.

- [ ] **Step 6: Typecheck, run server-adjacent tests, commit**

```bash
npm run typecheck
npx vitest run --exclude "tests/integration/**"
git add -A
git commit -m "fix(analytics): durable server captures via after() and session stitching"
```

---

### Task 7: Harden instrumentation-client.ts (cookieless + no autocapture)

**Files:**
- Modify: `instrumentation-client.ts`

- [ ] **Step 1: Replace the file contents**

```ts
// instrumentation-client.ts
import posthog from "posthog-js";
import { persistenceFor, readConsentChoice } from "@/lib/analytics/consent";

// Cookieless by default (spec §2): memory persistence until the visitor
// accepts the consent prompt or logs in. Autocapture stays off because
// invoice content renders in the DOM (spec §3).
const consentChoice =
  typeof window === "undefined" ? null : readConsentChoice(window.localStorage);

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/ingest",
  ui_host: "https://eu.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,
  autocapture: false,
  persistence: persistenceFor(consentChoice),
  debug: process.env.NODE_ENV === "development"
});
```

- [ ] **Step 2: Verify in the browser**

Run the dev server (`npm run dev -- --port 3100` in this worktree), open `http://localhost:3100`, and in DevTools confirm: network requests to `/ingest/` fire (pageview), Application → Cookies has **no** `ph_*` cookie, Application → Local Storage has **no** `ph_*` key.

- [ ] **Step 3: Commit**

```bash
git add instrumentation-client.ts
git commit -m "fix(analytics): cookieless persistence and autocapture off by default"
```

---

### Task 8: Consent prompt component

**Files:**
- Create: `components/analytics/consent-prompt.tsx`
- Modify: `app/layout.tsx`
- Test: `tests/components/analytics/consent-prompt.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/components/analytics/consent-prompt.test.tsx
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const posthogMock = vi.hoisted(() => ({ set_config: vi.fn() }));
vi.mock("posthog-js", () => ({ default: posthogMock }));

// The factory closes over this binding but only dereferences it at render
// time, so a plain let is safe here.
let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { ConsentPrompt } from "@/components/analytics/consent-prompt";
import { CONSENT_STORAGE_KEY } from "@/lib/analytics/consent";

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  pathname = "/";
});

describe("ConsentPrompt", () => {
  it("appears for visitors with no stored choice (PL copy on PL routes)", async () => {
    render(<ConsentPrompt />);
    expect(await screen.findByRole("button", { name: "Zgadzam się" })).toBeInTheDocument();
  });

  it("uses English copy under /en", async () => {
    pathname = "/en";
    render(<ConsentPrompt />);
    expect(await screen.findByRole("button", { name: "Accept" })).toBeInTheDocument();
  });

  it("stays hidden when a choice is already stored", () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ value: "declined", at: new Date().toISOString() })
    );
    render(<ConsentPrompt />);
    expect(screen.queryByRole("button", { name: "Zgadzam się" })).toBeNull();
  });

  it("accept stores the choice, upgrades persistence, and hides", async () => {
    const user = userEvent.setup();
    render(<ConsentPrompt />);
    await user.click(await screen.findByRole("button", { name: "Zgadzam się" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Zgadzam się" })).toBeNull()
    );
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toContain("accepted");
    expect(posthogMock.set_config).toHaveBeenCalledWith({
      persistence: "localStorage+cookie"
    });
  });

  it("decline stores the choice and keeps memory persistence", async () => {
    const user = userEvent.setup();
    render(<ConsentPrompt />);
    await user.click(await screen.findByRole("button", { name: "Nie teraz" }));
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toContain("declined");
    expect(posthogMock.set_config).toHaveBeenCalledWith({ persistence: "memory" });
  });
});
```

Note: if `userEvent` is not already a dependency, use `fireEvent.click` from `@testing-library/react` instead (check existing component tests for the established pattern and match it).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/analytics/consent-prompt.test.tsx`
Expected: FAIL, cannot resolve the component.

- [ ] **Step 3: Implement the component**

```tsx
// components/analytics/consent-prompt.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import {
  persistenceFor,
  readConsentChoice,
  shouldShowConsentPrompt,
  storeConsentChoice,
  type ConsentValue
} from "@/lib/analytics/consent";

const COPY = {
  pl: {
    body: "Analityka działa u nas bez plików cookie. Jeśli się zgodzisz, zapamiętamy Cię między wizytami i łatwiej nam będzie ulepszać produkt.",
    accept: "Zgadzam się",
    decline: "Nie teraz",
    ariaLabel: "Zgoda na pliki cookie analityki"
  },
  en: {
    body: "Our analytics works without cookies. If you agree, we will remember you between visits, which helps us improve the product.",
    accept: "Accept",
    decline: "Not now",
    ariaLabel: "Analytics cookie consent"
  }
} as const;

export function ConsentPrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  // Reading localStorage is an external-system sync, so useEffect is the
  // right tool here; it also avoids an SSR hydration mismatch.
  useEffect(() => {
    setVisible(
      shouldShowConsentPrompt(readConsentChoice(window.localStorage), new Date())
    );
  }, []);

  if (!visible) return null;

  const locale = pathname?.startsWith("/en") ? "en" : "pl";
  const t = COPY[locale];

  function choose(value: ConsentValue) {
    const choice = storeConsentChoice(window.localStorage, value, new Date());
    posthog.set_config({ persistence: persistenceFor(choice) });
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label={t.ariaLabel}
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-border bg-surface p-4 shadow-lg"
    >
      <p className="text-small text-text">{t.body}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => choose("accepted")}
          className="rounded-md bg-text-strong px-3 py-2 text-small font-medium text-surface hover:opacity-90"
        >
          {t.accept}
        </button>
        <button
          type="button"
          onClick={() => choose("declined")}
          className="rounded-md px-3 py-2 text-small text-text hover:bg-surface-muted"
        >
          {t.decline}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mount it in the root layout**

In `app/layout.tsx`, add the import and render it inside `<body>` after `{children}`:

```tsx
import { ConsentPrompt } from "@/components/analytics/consent-prompt";

// in RootLayout's return:
<body className="bg-surface text-text-strong">
  {children}
  <ConsentPrompt />
</body>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/components/analytics/consent-prompt.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add components/analytics/consent-prompt.tsx app/layout.tsx \
  tests/components/analytics/consent-prompt.test.tsx
git commit -m "feat(analytics): add cookie consent prompt with persistence upgrade"
```

---

### Task 9: Identify on login, reset on sign-out

**Files:**
- Create: `components/analytics/identify-user.tsx`
- Create: `components/layout/sign-out-button.tsx`
- Modify: `app/(protected)/layout.tsx`
- Modify: `components/layout/authenticated-header.tsx:44-51`
- Test: `tests/components/analytics/identify-user.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/analytics/identify-user.test.tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const identifyAuthenticatedUserMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({
  identifyAuthenticatedUser: identifyAuthenticatedUserMock
}));

import { IdentifyUser } from "@/components/analytics/identify-user";

describe("IdentifyUser", () => {
  it("identifies the user on mount and renders nothing", () => {
    const { container } = render(
      <IdentifyUser userId="user-1" email="a@b.pl" locale="pl" />
    );
    expect(identifyAuthenticatedUserMock).toHaveBeenCalledWith("user-1", {
      email: "a@b.pl",
      locale: "pl"
    });
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/analytics/identify-user.test.tsx`
Expected: FAIL, cannot resolve the component.

- [ ] **Step 3: Implement both components**

```tsx
// components/analytics/identify-user.tsx
"use client";

import { useEffect } from "react";
import { identifyAuthenticatedUser } from "@/lib/analytics/client";

export function IdentifyUser({
  userId,
  email,
  locale
}: {
  userId: string;
  email?: string;
  locale?: string;
}) {
  // Syncing the PostHog external system with the auth state.
  useEffect(() => {
    identifyAuthenticatedUser(userId, { email, locale });
  }, [userId, email, locale]);

  return null;
}
```

```tsx
// components/layout/sign-out-button.tsx
"use client";

import { resetAnalyticsIdentity } from "@/lib/analytics/client";

/**
 * Submit button for the sign-out server-action form. Resets the analytics
 * identity on click, before the action redirects away.
 */
export function SignOutButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      onClick={() => resetAnalyticsIdentity()}
      className="rounded-md px-3 py-2 text-small text-text hover:bg-surface-muted"
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 4: Mount IdentifyUser in the protected layout**

In `app/(protected)/layout.tsx` add the import and render it as the first child of the returned `<div>`:

```tsx
import { IdentifyUser } from "@/components/analytics/identify-user";

// inside the returned <div className="flex min-h-screen ...">, first child:
<IdentifyUser userId={user.id} email={user.email ?? undefined} locale={uiLanguage} />
```

- [ ] **Step 5: Swap the header button**

In `components/layout/authenticated-header.tsx`, add `import { SignOutButton } from "@/components/layout/sign-out-button";` and replace the inline button (lines 44 to 51):

```tsx
<form action={signOutAction}>
  <SignOutButton label={labels.signOut} />
</form>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/components/analytics` and `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/analytics/identify-user.tsx components/layout/sign-out-button.tsx \
  "app/(protected)/layout.tsx" components/layout/authenticated-header.tsx \
  tests/components/analytics/identify-user.test.tsx
git commit -m "feat(analytics): identify by Supabase user id, reset on sign-out"
```

---

### Task 10: Middleware exclusion and .env.example

**Files:**
- Modify: `middleware.ts:10`
- Modify: `.env.example` (append)

- [ ] **Step 1: Exclude /ingest from the Supabase session middleware**

Replace the matcher line in `middleware.ts`:

```ts
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|studio|ingest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
```

- [ ] **Step 2: Document the env vars**

Append to `.env.example`:

```bash
# ── PostHog (EU cloud) ─────────────────────────────────────────────────
# Project token from https://eu.posthog.com/project/settings. Public:
# shipped to the browser. The host is used by the server SDK; the browser
# talks to PostHog through the /ingest rewrite in next.config.ts.
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

- [ ] **Step 3: Verify and commit**

Run: `npm run dev -- --port 3100`, then `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3100/ingest/array/phc_test/config?v=1"` — any non-404 response (200/400 from PostHog's edge) confirms the rewrite proxies; the middleware no longer logs Supabase calls for it.

```bash
git add middleware.ts .env.example
git commit -m "chore(analytics): exclude /ingest from middleware, document env vars"
```

---

### Task 11: Privacy policy sub-processor disclosure

**Files:**
- Modify: `lib/legal/privacy/pl.ts` (sub-processor list, after the Resend entry at line 53)
- Modify: `lib/legal/privacy/en.ts` (after line 51)
- Test: extend `tests/lib/legal/privacy-content.test.ts`

- [ ] **Step 1: Add failing test assertions**

Add to `tests/lib/legal/privacy-content.test.ts` inside the existing describe block:

```ts
it("discloses PostHog as an analytics sub-processor in both locales", () => {
  // use this file's existing accessors for the PL and EN documents
  expect(JSON.stringify(privacyPl)).toContain("PostHog");
  expect(JSON.stringify(privacyEn)).toContain("PostHog");
});
```

(Match the import names already used at the top of that test file.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/lib/legal/privacy-content.test.ts`
Expected: FAIL on the new assertion.

- [ ] **Step 3: Add the entries**

In `lib/legal/privacy/pl.ts`, append to the numbered sub-processor list (after the Resend line):

```
6. PostHog (PostHog EU): analityka produktowa i statystyki użycia aplikacji; dane przechowywane w Unii Europejskiej (region Frankfurt). U niezalogowanych użytkowników analityka działa bez plików cookie; zalogowanych użytkowników identyfikujemy w ramach prawnie uzasadnionego interesu, aby rozumieć korzystanie z produktu.
```

In `lib/legal/privacy/en.ts`, append the equivalent:

```
6. PostHog (PostHog EU): product analytics and usage statistics; data stored in the European Union (Frankfurt region). For visitors who are not signed in, analytics runs without cookies; signed-in users are identified under our legitimate interest in understanding how the product is used.
```

Both files keep their existing template-string list format; add the line in the same string block, matching indentation. Do not touch the US-transfer paragraph (PostHog EU keeps data in the EU).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/lib/legal/privacy-content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/legal/privacy/pl.ts lib/legal/privacy/en.ts tests/lib/legal/privacy-content.test.ts
git commit -m "docs(legal): disclose PostHog EU analytics sub-processor"
```

---

### Task 12: Analytics documentation

**Files:**
- Create: `docs/analytics.md`

- [ ] **Step 1: Write the doc**

Content requirements (write it out fully, no placeholders):

- Link to the spec and to PostHog project 199578 (EU), dashboard 740875.
- The full current event catalog table (copy from spec §5, marking which events are live after this PR: the 14 wizard events).
- How to add an event: extend `AnalyticsEventMap` + `EVENT_PROPERTY_KEYS`, call `captureClient`/`captureServer`, never raw `posthog.capture`.
- The PII rules verbatim from spec §4.
- Consent model summary: memory persistence default, prompt upgrade, identified users, sign-out reset, 180-day decline re-prompt.
- Env vars and the /ingest proxy note (middleware exclusion, `skipTrailingSlashRedirect`).
- Pending: PR 2 acquisition-funnel events, PR 3 product-depth events, dashboard buildout list from spec §7.

- [ ] **Step 2: Commit**

```bash
git add docs/analytics.md
git commit -m "docs(analytics): add analytics guide and event catalog reference"
```

---

### Task 13: E2E proof of cookieless capture and consent upgrade

**Files:**
- Create: `tests/e2e/analytics-consent.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/analytics-consent.spec.ts
import { expect, test } from "@playwright/test";

// These tests need NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN/HOST available to the
// dev server (present in .env.local; .env.test must not blank them).

test("landing captures through /ingest without cookies before consent", async ({
  page
}) => {
  const ingestRequest = page.waitForRequest(
    (req) => req.url().includes("/ingest/"),
    { timeout: 15_000 }
  );
  await page.goto("/");
  await ingestRequest;

  const cookies = await page.context().cookies();
  expect(cookies.filter((c) => c.name.startsWith("ph_"))).toHaveLength(0);

  const phStorageKeys = await page.evaluate(() =>
    Object.keys(window.localStorage).filter((k) => k.startsWith("ph_"))
  );
  expect(phStorageKeys).toHaveLength(0);
});

test("accepting consent upgrades persistence", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Zgadzam się" }).click();

  await expect
    .poll(async () =>
      page.evaluate(() => window.localStorage.getItem("ksef-analytics-consent"))
    )
    .toContain("accepted");

  await expect
    .poll(async () =>
      page.evaluate(() =>
        Object.keys(window.localStorage).filter((k) => k.startsWith("ph_")).length
      )
    )
    .toBeGreaterThan(0);
});

test("declining consent keeps storage clean", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nie teraz" }).click();

  await expect
    .poll(async () =>
      page.evaluate(() => window.localStorage.getItem("ksef-analytics-consent"))
    )
    .toContain("declined");

  const phStorageKeys = await page.evaluate(() =>
    Object.keys(window.localStorage).filter((k) => k.startsWith("ph_"))
  );
  expect(phStorageKeys).toHaveLength(0);
});
```

- [ ] **Step 2: Run it**

Run: `E2E_PORT=3105 npx playwright test tests/e2e/analytics-consent.spec.ts`
Expected: 3 passed. (The config starts its own dev server on 3105; the user's preview server on 3000 is untouched.)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/analytics-consent.spec.ts
git commit -m "test(analytics): e2e proof of cookieless capture and consent upgrade"
```

---

### Task 14: Full verification and PR

- [ ] **Step 1: Full local gate**

```bash
npm run typecheck
npm run lint
npx vitest run --exclude "tests/integration/**"
E2E_PORT=3105 npx playwright test tests/e2e/analytics-consent.spec.ts
```

Expected: all green (integration tests run separately per the test-harness notes; the known send-email-hook env failures are pre-existing).

- [ ] **Step 2: Manual smoke against PostHog**

Start the dev server, click through: landing → login (magic link send) → translate an invoice → download PDF. In PostHog (EU project 199578) Activity view, confirm `login_submitted`, `login_email_sent`, `files_uploaded`, `translation_started`, `invoice_translated`, `pdf_downloaded` arrive, and that the logged-in events share one person (the Supabase user id).

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin claude/posthog-analytics
gh pr create --base main --title "feat(analytics): PostHog foundation (cookieless consent, typed catalog, durable server capture)" --body "<summary per git-workflow.md: wizard baseline + foundation fixes, test plan, link to spec>"
```

Before merge (manual, outside the repo): add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to the Vercel project env vars.

---

## Follow-up plans (not in this PR)

- **PR 2 — acquisition funnel** (plan to be written after PR 1 merges): demo + landing + contact events, server-side auth completion (`signup_completed`/`login_completed`/`auth_failed` in `app/auth/callback/route.ts`), onboarding events, demo + activation dashboards. Event list: spec §5.
- **PR 3 — product depth**: `paywall_hit`, wizard language/bilingual/retry events, editor events, `credit_drawer_opened`, `checkout_cancelled`, account events + PostHog person erasure on account deletion, paywall + quality dashboards. Event list: spec §5.
