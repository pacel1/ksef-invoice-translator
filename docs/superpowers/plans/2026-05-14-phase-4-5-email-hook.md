# KSeF SaaS Phase 4.5: Bilingual Auth Emails via Resend + Supabase Auth Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase's default English auth emails with bilingual (PL/EN) React Email templates, delivered through Resend's HTTP API via a Supabase Send Email Hook. Per-user locale is read from `profiles.locale` so each user gets their own language.

**Architecture:** Supabase's auth pipeline (signInWithOtp / signup / recovery / email-change) no longer sends emails itself — it POSTs a signed webhook to `POST /api/auth/send-email-hook` with the user + token + action type. Our endpoint verifies the Standard Webhooks signature, looks up the user's locale from `profiles`, renders a React Email template, and ships the HTML through Resend's HTTP API. Resend handles delivery + bounces; we own the content. Native SMTP stays configured as a fallback (Supabase falls back if the hook returns non-2xx repeatedly), but the hook owns the happy path.

**Tech Stack:** Next.js 15 Route Handler (`runtime: nodejs`), `resend` Node SDK, `@react-email/components` + `@react-email/render` for typed templates with inlined styles, `standardwebhooks` for signature verification, Vitest for unit + integration tests, Supabase Management API to configure the hook.

**Out of scope for this phase:**
- Custom templates for password reset / email change beyond a minimal MVP — magic link is the only auth flow this app actually uses today, but we cover the other action types so they aren't broken.
- `react-email dev` preview server config — useful but not required for shipping.
- A `from` address other than the one already verified in Resend.

---

## Pre-requisites (verify before starting)

- `RESEND_API_KEY=re_...` in `.env.local` AND `.env.test`. Verified: ✓ (36 chars, `re_` prefix).
- `SUPABASE_AUTH_HOOK_SECRET=v1,whsec_...` in `.env.local` AND `.env.test`. Verified: ✓ (89 chars, `v1,whsec_` prefix per Standard Webhooks spec).
- Resend verified sender domain — confirm at https://resend.com/domains. If `tlumaczksef.pl` isn't verified yet, use `onboarding@resend.dev` for testing (Resend's sandbox; sends only to your account email).
- Supabase Personal Access Token — held by the controller for the final Management API config step.

---

## File Structure

### New files

- `emails/magic-link.tsx` — React Email component for the magic-link email. Props: `{ link: string; locale: "pl" | "en"; recipientEmail: string }`. Bilingual branching inside.
- `emails/render-template.ts` — Server-only renderer. Maps `email_action_type` to a template + subject. Returns `{ subject, html, plainText }`. Pure function, easy to unit-test.
- `lib/auth/send-email-hook.ts` — Server-only orchestration: verify signature, look up locale, build action URL, render template, send via Resend, structured logging. Pure-ish (depends on Supabase admin client + Resend SDK passed in).
- `app/api/auth/send-email-hook/route.ts` — Next route handler. Thin wrapper: reads raw body, fetches verified user, calls `lib/auth/send-email-hook.ts`, maps errors to status codes.
- `tests/integration/lib/send-email-hook.test.ts` — Vitest covering signature verification, locale lookup, template rendering, Resend SDK invocation. Resend is mocked.
- `tests/integration/api/send-email-hook.test.ts` — Vitest covering the route handler: 401 on missing/bad signature, 200 on valid payload, payload shape for `magiclink`, `signup`, `recovery`, `email_change`.

### Modified files

- `package.json` — new deps: `resend`, `@react-email/components`, `@react-email/render`, `standardwebhooks`.
- `.env.example` — document `RESEND_API_KEY`, `SUPABASE_AUTH_HOOK_SECRET`.
- `.env.test.example` — same.
- `README.md` — new "Auth emails (Phase 4.5)" section.

### Files NOT touched

- `app/login/login-form.tsx`, `app/auth/callback/route.ts` — the auth flow is unchanged. The hook intercepts Supabase's email pipeline, not the app's auth code.
- `app/(protected)/layout.tsx`, the workspace, billing — all unrelated.
- The existing SMTP config we set up earlier — stays as Supabase's fallback if the hook ever returns non-2xx persistently. Not actively wired up to anything code-level.

---

## Tasks

### Task 1: Install dependencies + env docs

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.env.test.example`

- [ ] **Step 1: Install runtime deps**

```bash
npm install resend @react-email/components @react-email/render standardwebhooks
```

All four are runtime deps (not devDependencies) because they're used in the route handler.

- [ ] **Step 2: Document the new env vars**

In `.env.example`, append:

```
# Auth email hook (Phase 4.5)
RESEND_API_KEY=
SUPABASE_AUTH_HOOK_SECRET=
```

In `.env.test.example`, append the same two lines (with empty values).

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: PASS. No code consumes the new deps yet.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example .env.test.example
git commit -m "chore: resend + react-email + standardwebhooks for auth-email hook"
```

---

### Task 2: React Email template — magic link

**Files:**
- Create: `emails/magic-link.tsx`

Each email template is a self-contained React component that compiles to inlined HTML.

- [ ] **Step 1: Write the template**

Create `emails/magic-link.tsx`:

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text
} from "@react-email/components";

export interface MagicLinkEmailProps {
  link: string;
  locale: "pl" | "en";
  recipientEmail: string;
}

const copy = {
  pl: {
    preview: "Zaloguj się do KSeF Translator",
    heading: "Zaloguj się jednym kliknięciem",
    body: "Kliknij poniższy przycisk, aby zalogować się do KSeF Translator. Link jest jednorazowy i wygasa po godzinie.",
    button: "Zaloguj się",
    fallback: "Jeśli przycisk nie działa, skopiuj ten link do przeglądarki:",
    ignore: "Jeśli nie próbowałeś się zalogować, możesz zignorować tę wiadomość.",
    footer: "KSeF Translator — narzędzie do tłumaczenia faktur KSeF dla zagranicznych kontrahentów."
  },
  en: {
    preview: "Sign in to KSeF Translator",
    heading: "One-click sign-in",
    body: "Click the button below to sign in to KSeF Translator. The link is single-use and expires in one hour.",
    button: "Sign in",
    fallback: "If the button doesn't work, copy this link into your browser:",
    ignore: "If you didn't try to sign in, you can ignore this email.",
    footer: "KSeF Translator — invoice translation for Polish businesses working with foreign contractors."
  }
} as const;

export function MagicLinkEmail({ link, locale, recipientEmail }: MagicLinkEmailProps) {
  const t = copy[locale];

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Tailwind>
        <Body className="bg-slate-50 font-sans">
          <Container className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm">
            <Heading className="text-2xl font-semibold text-slate-950">{t.heading}</Heading>
            <Text className="mt-3 text-base leading-7 text-slate-700">{t.body}</Text>

            <Section className="mt-6 text-center">
              <Button
                href={link}
                className="rounded-md bg-slate-950 px-6 py-3 text-sm font-semibold text-white"
              >
                {t.button}
              </Button>
            </Section>

            <Text className="mt-6 text-sm text-slate-600">{t.fallback}</Text>
            <Text className="break-all rounded-md bg-slate-100 p-3 text-xs text-slate-700">
              <a href={link} className="text-slate-700 underline">{link}</a>
            </Text>

            <Hr className="my-6 border-slate-200" />

            <Text className="text-xs text-slate-500">{t.ignore}</Text>
            <Text className="mt-2 text-xs text-slate-400">{t.footer}</Text>
            <Text className="mt-1 text-xs text-slate-400">{recipientEmail}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default MagicLinkEmail;
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS. (No tests for this file yet — the template is exercised via `render-template.ts` tests in Task 3.)

- [ ] **Step 3: Commit**

```bash
git add emails/magic-link.tsx
git commit -m "feat(emails): bilingual magic-link template"
```

---

### Task 3: Template renderer with subject + HTML

**Files:**
- Create: `emails/render-template.ts`
- Test: `tests/integration/lib/render-template.test.tsx`

The renderer maps Supabase's `email_action_type` strings to template + subject. For Phase 4.5 only `magiclink` gets the full bilingual template; the other action types (`signup`, `recovery`, `email_change`) get the same magic-link template (since the magic-link flow IS our signup+login UX) with action-specific subjects.

- [ ] **Step 1: Write failing test**

Create `tests/integration/lib/render-template.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderAuthEmail, type SupabaseEmailActionType } from "@/emails/render-template";

describe("renderAuthEmail", () => {
  const baseInput = {
    link: "https://ksef-invoice-translator.vercel.app/auth/callback?token_hash=abc&type=email",
    recipientEmail: "test@example.com"
  };

  it("renders the PL magic-link email with a Polish subject", async () => {
    const result = await renderAuthEmail({
      ...baseInput,
      locale: "pl",
      actionType: "magiclink"
    });

    expect(result.subject).toMatch(/zaloguj/i);
    expect(result.html).toContain("Zaloguj się jednym kliknięciem");
    expect(result.html).toContain(baseInput.link);
    expect(result.plainText).toContain(baseInput.link);
  });

  it("renders the EN magic-link email with an English subject", async () => {
    const result = await renderAuthEmail({
      ...baseInput,
      locale: "en",
      actionType: "magiclink"
    });

    expect(result.subject).toMatch(/sign in/i);
    expect(result.html).toContain("One-click sign-in");
  });

  it("uses a signup-flavored subject for action_type='signup' but the same template", async () => {
    const result = await renderAuthEmail({
      ...baseInput,
      locale: "en",
      actionType: "signup"
    });
    expect(result.subject).toMatch(/sign in/i);
    expect(result.html).toContain("One-click sign-in");
  });

  it("uses a recovery-flavored subject for action_type='recovery'", async () => {
    const result = await renderAuthEmail({
      ...baseInput,
      locale: "en",
      actionType: "recovery"
    });
    expect(result.subject).toMatch(/sign in|recover/i);
  });

  it("falls back to EN for an unknown locale", async () => {
    const result = await renderAuthEmail({
      ...baseInput,
      locale: "de" as unknown as "pl" | "en",
      actionType: "magiclink"
    });
    expect(result.subject).toMatch(/sign in/i);
  });

  it("inlines the link into both html and plainText", async () => {
    const result = await renderAuthEmail({
      ...baseInput,
      locale: "pl",
      actionType: "magiclink"
    });
    expect(result.html).toContain(baseInput.link);
    expect(result.plainText).toContain(baseInput.link);
  });
});

export type _ExportToSatisfyVitestModule = SupabaseEmailActionType;
```

- [ ] **Step 2: Run, expect fail**

```bash
npm test -- render-template
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `emails/render-template.ts`:

```ts
import { render } from "@react-email/render";
import { MagicLinkEmail } from "./magic-link";

export type SupabaseEmailActionType =
  | "signup"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "invite"
  | "email";

export type EmailLocale = "pl" | "en";

export interface RenderAuthEmailOptions {
  link: string;
  locale: EmailLocale | string;
  recipientEmail: string;
  actionType: SupabaseEmailActionType | string;
}

export interface RenderedAuthEmail {
  subject: string;
  html: string;
  plainText: string;
}

const SUBJECTS: Record<EmailLocale, Record<SupabaseEmailActionType, string>> = {
  pl: {
    signup: "Zaloguj się do KSeF Translator",
    magiclink: "Zaloguj się do KSeF Translator",
    recovery: "Zaloguj się do KSeF Translator",
    email_change: "Potwierdź zmianę adresu email",
    invite: "Zaproszenie do KSeF Translator",
    email: "Zaloguj się do KSeF Translator"
  },
  en: {
    signup: "Sign in to KSeF Translator",
    magiclink: "Sign in to KSeF Translator",
    recovery: "Sign in to KSeF Translator",
    email_change: "Confirm your new email address",
    invite: "You're invited to KSeF Translator",
    email: "Sign in to KSeF Translator"
  }
};

function normalizeLocale(locale: string): EmailLocale {
  return locale === "pl" ? "pl" : "en";
}

function normalizeActionType(actionType: string): SupabaseEmailActionType {
  const allowed: SupabaseEmailActionType[] = [
    "signup",
    "magiclink",
    "recovery",
    "email_change",
    "invite",
    "email"
  ];
  return (allowed.includes(actionType as SupabaseEmailActionType)
    ? actionType
    : "magiclink") as SupabaseEmailActionType;
}

export async function renderAuthEmail(opts: RenderAuthEmailOptions): Promise<RenderedAuthEmail> {
  const locale = normalizeLocale(opts.locale);
  const actionType = normalizeActionType(opts.actionType);

  const subject = SUBJECTS[locale][actionType];

  const element = MagicLinkEmail({
    link: opts.link,
    locale,
    recipientEmail: opts.recipientEmail
  });

  const [html, plainText] = await Promise.all([
    render(element),
    render(element, { plainText: true })
  ]);

  return { subject, html, plainText };
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- render-template
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add emails/render-template.ts tests/integration/lib/render-template.test.tsx
git commit -m "feat(emails): renderAuthEmail with bilingual subjects + locale fallback"
```

---

### Task 4: Send-email-hook orchestration (signature + locale + Resend)

**Files:**
- Create: `lib/auth/send-email-hook.ts`
- Test: `tests/integration/lib/send-email-hook.test.ts`

The pure-ish orchestration function takes the raw request body, the signature headers, the admin client, and a Resend client (injected for testability). Returns the Resend send result on success; throws on signature failure or missing user.

- [ ] **Step 1: Write failing test**

Create `tests/integration/lib/send-email-hook.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { Webhook } from "standardwebhooks";
import { createClient } from "@supabase/supabase-js";
import { processAuthEmailHook, AuthHookError } from "@/lib/auth/send-email-hook";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const HOOK_SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET!;

const createdUserIds: string[] = [];

async function newUserWithLocale(label: string, locale: "pl" | "en") {
  const email = `hook-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  const id = data.user!.id;
  createdUserIds.push(id);
  await admin.from("profiles").update({ locale }).eq("id", id);
  return { userId: id, email };
}

function sign(payload: string): { headers: Record<string, string> } {
  const wh = new Webhook(HOOK_SECRET);
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const timestamp = new Date();
  const signature = wh.sign(id, timestamp, payload);
  return {
    headers: {
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": signature
    }
  };
}

function buildPayload(email: string, actionType = "magiclink") {
  return JSON.stringify({
    user: { email, id: "00000000-0000-0000-0000-000000000001" },
    email_data: {
      token: "abc123",
      token_hash: "tokenhash123",
      redirect_to: "/app",
      email_action_type: actionType,
      site_url: "http://localhost:3000",
      token_new: "",
      token_hash_new: ""
    }
  });
}

afterEach(async () => {
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()!;
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe("processAuthEmailHook", () => {
  it("rejects payloads with no signature headers", async () => {
    const resendSend = vi.fn();
    await expect(
      processAuthEmailHook({
        rawBody: buildPayload("test@example.com"),
        headers: {},
        supabase: admin,
        resendSend,
        hookSecret: HOOK_SECRET,
        appUrl: "http://localhost:3000"
      })
    ).rejects.toBeInstanceOf(AuthHookError);
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("rejects payloads with bad signatures", async () => {
    const resendSend = vi.fn();
    const payload = buildPayload("test@example.com");
    await expect(
      processAuthEmailHook({
        rawBody: payload,
        headers: {
          "webhook-id": "x",
          "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
          "webhook-signature": "v1,deadbeef"
        },
        supabase: admin,
        resendSend,
        hookSecret: HOOK_SECRET,
        appUrl: "http://localhost:3000"
      })
    ).rejects.toBeInstanceOf(AuthHookError);
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("renders the PL template for a PL-locale user and sends via Resend", async () => {
    const { email } = await newUserWithLocale("pl-user", "pl");
    const payload = buildPayload(email);
    const { headers } = sign(payload);
    const resendSend = vi.fn().mockResolvedValue({ data: { id: "re_xyz" } });

    const result = await processAuthEmailHook({
      rawBody: payload,
      headers,
      supabase: admin,
      resendSend,
      hookSecret: HOOK_SECRET,
      appUrl: "https://ksef-invoice-translator.vercel.app"
    });

    expect(result.providerId).toBe("re_xyz");
    expect(resendSend).toHaveBeenCalledTimes(1);
    const call = resendSend.mock.calls[0][0];
    expect(call.to).toBe(email);
    expect(call.subject).toMatch(/zaloguj/i);
    expect(call.html).toContain("Zaloguj się jednym kliknięciem");
    expect(call.html).toContain(
      "https://ksef-invoice-translator.vercel.app/auth/callback?token_hash=tokenhash123"
    );
  });

  it("renders the EN template for an EN-locale user", async () => {
    const { email } = await newUserWithLocale("en-user", "en");
    const payload = buildPayload(email);
    const { headers } = sign(payload);
    const resendSend = vi.fn().mockResolvedValue({ data: { id: "re_abc" } });

    await processAuthEmailHook({
      rawBody: payload,
      headers,
      supabase: admin,
      resendSend,
      hookSecret: HOOK_SECRET,
      appUrl: "https://ksef-invoice-translator.vercel.app"
    });

    const call = resendSend.mock.calls[0][0];
    expect(call.subject).toMatch(/sign in/i);
    expect(call.html).toContain("One-click sign-in");
  });

  it("falls back to EN when the user has no profile row", async () => {
    // We don't create a profile — just call with an arbitrary email.
    const payload = buildPayload("ghost@example.test");
    const { headers } = sign(payload);
    const resendSend = vi.fn().mockResolvedValue({ data: { id: "re_ghost" } });

    await processAuthEmailHook({
      rawBody: payload,
      headers,
      supabase: admin,
      resendSend,
      hookSecret: HOOK_SECRET,
      appUrl: "http://localhost:3000"
    });

    const call = resendSend.mock.calls[0][0];
    expect(call.subject).toMatch(/sign in/i);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npm test -- send-email-hook
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/auth/send-email-hook.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { Webhook } from "standardwebhooks";
import type { Database } from "@/lib/supabase/database.types";
import { renderAuthEmail } from "@/emails/render-template";

export class AuthHookError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "AuthHookError";
  }
}

export interface ResendSendInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface ResendSendResult {
  data?: { id?: string } | null;
  error?: { message?: string } | null;
}

export type ResendSendFn = (input: ResendSendInput) => Promise<ResendSendResult>;

export interface ProcessAuthEmailHookOptions {
  rawBody: string;
  headers: Record<string, string | undefined>;
  supabase: SupabaseClient<Database>;
  resendSend: ResendSendFn;
  hookSecret: string;
  appUrl: string;
  /** Sender address — defaults to `auth@<APP_HOST>`. Override per env if needed. */
  fromAddress?: string;
}

interface SupabaseEmailHookPayload {
  user: { id?: string; email: string };
  email_data: {
    token?: string;
    token_hash: string;
    redirect_to?: string;
    email_action_type: string;
    site_url?: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

export async function processAuthEmailHook(
  opts: ProcessAuthEmailHookOptions
): Promise<{ providerId: string | null }> {
  const sigHeaders = {
    "webhook-id": opts.headers["webhook-id"] ?? "",
    "webhook-timestamp": opts.headers["webhook-timestamp"] ?? "",
    "webhook-signature": opts.headers["webhook-signature"] ?? ""
  };

  if (!sigHeaders["webhook-id"] || !sigHeaders["webhook-signature"]) {
    throw new AuthHookError("Missing webhook signature headers", 401);
  }

  let payload: SupabaseEmailHookPayload;
  try {
    const wh = new Webhook(opts.hookSecret);
    payload = wh.verify(opts.rawBody, sigHeaders) as SupabaseEmailHookPayload;
  } catch (error) {
    throw new AuthHookError(
      `Invalid webhook signature: ${error instanceof Error ? error.message : "verify failed"}`,
      401
    );
  }

  const email = payload.user?.email;
  const tokenHash = payload.email_data?.token_hash;
  const actionType = payload.email_data?.email_action_type ?? "magiclink";
  const redirectTo = payload.email_data?.redirect_to ?? "/app";

  if (!email || !tokenHash) {
    throw new AuthHookError("Payload missing email or token_hash", 400);
  }

  // Look up locale (best-effort; default to en).
  let locale: "pl" | "en" = "en";
  if (payload.user.id) {
    const { data: profile } = await opts.supabase
      .from("profiles")
      .select("locale")
      .eq("id", payload.user.id)
      .maybeSingle();
    if (profile?.locale === "pl") locale = "pl";
  }

  const callbackPath = `/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(
    actionType === "magiclink" ? "email" : actionType
  )}&redirect_to=${encodeURIComponent(redirectTo)}`;
  const link = `${opts.appUrl}${callbackPath}`;

  const { subject, html, plainText } = await renderAuthEmail({
    link,
    locale,
    recipientEmail: email,
    actionType
  });

  const fromAddress = opts.fromAddress ?? defaultFromAddress(opts.appUrl);

  const result = await opts.resendSend({
    from: fromAddress,
    to: email,
    subject,
    html,
    text: plainText
  });

  if (result.error) {
    console.error("[auth-email-hook] resend send failed:", result.error);
    throw new AuthHookError(`Email send failed: ${result.error.message ?? "unknown"}`, 502);
  }

  return { providerId: result.data?.id ?? null };
}

function defaultFromAddress(appUrl: string): string {
  try {
    const host = new URL(appUrl).host.replace(/^www\./, "");
    return `KSeF Translator <auth@${host}>`;
  } catch {
    return "KSeF Translator <onboarding@resend.dev>";
  }
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- send-email-hook
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/send-email-hook.ts tests/integration/lib/send-email-hook.test.ts
git commit -m "feat(auth): processAuthEmailHook with signature verification + locale + render + resend"
```

---

### Task 5: Route handler at `/api/auth/send-email-hook`

**Files:**
- Create: `app/api/auth/send-email-hook/route.ts`
- Test: `tests/integration/api/send-email-hook.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/integration/api/send-email-hook.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { Webhook } from "standardwebhooks";
import { createClient } from "@supabase/supabase-js";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const HOOK_SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET!;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const ping = await fetch(`${APP}/`).catch(() => null);
  if (!ping) throw new Error(`Next dev server not reachable at ${APP}.`);
  if (!HOOK_SECRET) throw new Error("SUPABASE_AUTH_HOOK_SECRET missing in .env.test");
});

afterEach(async () => {
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()!;
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

function sign(payload: string): Record<string, string> {
  const wh = new Webhook(HOOK_SECRET);
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const timestamp = new Date();
  const signature = wh.sign(id, timestamp, payload);
  return {
    "webhook-id": id,
    "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "webhook-signature": signature
  };
}

describe("POST /api/auth/send-email-hook", () => {
  it("returns 401 with no signature headers", async () => {
    const res = await fetch(`${APP}/api/auth/send-email-hook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: { email: "x@example.test" }, email_data: {} })
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 with a bad signature", async () => {
    const payload = JSON.stringify({ user: { email: "x@example.test" }, email_data: {} });
    const res = await fetch(`${APP}/api/auth/send-email-hook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "webhook-id": "msg_x",
        "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
        "webhook-signature": "v1,deadbeef"
      },
      body: payload
    });
    expect(res.status).toBe(401);
  });

  // We don't assert real email delivery here — that would require hitting Resend's API
  // with a verified sender. The unit tests in lib/send-email-hook cover the rendering
  // and Resend invocation with a mock. This integration test only confirms wiring.
  it("accepts a valid signature and returns 2xx OR 502 (Resend may reject test domains)", async () => {
    const email = `route-${Date.now()}@example.test`;
    const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
    const userId = data.user!.id;
    createdUserIds.push(userId);

    const payload = JSON.stringify({
      user: { id: userId, email },
      email_data: {
        token: "x",
        token_hash: "hashval",
        redirect_to: "/app",
        email_action_type: "magiclink",
        site_url: APP
      }
    });
    const res = await fetch(`${APP}/api/auth/send-email-hook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sign(payload) },
      body: payload
    });
    // 200: Resend accepted (real send happened). 502: Resend rejected the address (e.g. unverified domain).
    // Both prove signature verification + locale lookup + Resend call succeeded.
    expect([200, 502]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Write the route**

Create `app/api/auth/send-email-hook/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  AuthHookError,
  processAuthEmailHook,
  type ResendSendInput,
  type ResendSendResult
} from "@/lib/auth/send-email-hook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!hookSecret) {
    console.error("[api/auth/send-email-hook] SUPABASE_AUTH_HOOK_SECRET missing");
    return NextResponse.json({ error: "Hook not configured" }, { status: 500 });
  }
  if (!resendKey) {
    console.error("[api/auth/send-email-hook] RESEND_API_KEY missing");
    return NextResponse.json({ error: "Email provider not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const headers: Record<string, string | undefined> = {
    "webhook-id": request.headers.get("webhook-id") ?? undefined,
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? undefined,
    "webhook-signature": request.headers.get("webhook-signature") ?? undefined
  };

  const resend = new Resend(resendKey);
  const resendSend = async (input: ResendSendInput): Promise<ResendSendResult> => {
    const out = await resend.emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text
    });
    return out as ResendSendResult;
  };

  try {
    const { providerId } = await processAuthEmailHook({
      rawBody,
      headers,
      supabase: getSupabaseAdminClient(),
      resendSend,
      hookSecret,
      appUrl
    });
    return NextResponse.json({ ok: true, providerId });
  } catch (error) {
    if (error instanceof AuthHookError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[api/auth/send-email-hook] unexpected:", error);
    return NextResponse.json({ error: "Hook failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Start dev server + run, expect pass**

```bash
tmux kill-session -t next-dev 2>/dev/null || true
tmux new-session -d -s next-dev "cd /Users/jakubsledz/DEV/ksef-invoice-translator/.claude/worktrees/flamboyant-mahavira-511b75 && npx next dev"
sleep 6
curl -sSf http://localhost:3000 > /dev/null && echo "dev server up"
npm test -- tests/integration/api/send-email-hook.test
tmux kill-session -t next-dev
```

Expected: 3 passing.

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/send-email-hook/route.ts tests/integration/api/send-email-hook.test.ts
git commit -m "feat(api): /api/auth/send-email-hook signature-verified resend dispatch"
```

---

### Task 6: README — auth emails section

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append after "Stripe purchases (Phase 4)"**

Add this section before "Third-Party References":

```markdown
## Auth emails (Phase 4.5)

Magic-link and other auth emails are sent through Resend via a Supabase Send Email Hook. The hook target is `/api/auth/send-email-hook`.

### Flow

1. User submits `signInWithOtp` on `/login`.
2. Supabase generates the token + action URL internally.
3. Instead of sending email itself, Supabase POSTs a Standard Webhooks signed payload to `/api/auth/send-email-hook`.
4. Our route verifies the signature with `SUPABASE_AUTH_HOOK_SECRET`, looks up the user's `profiles.locale`, renders a bilingual React Email template, and calls `resend.emails.send(...)`.
5. Resend delivers the email; user clicks the link; flow continues through `/auth/callback`.

### Templates

`emails/magic-link.tsx` is a React Email component with PL/EN copy chosen at render time. Action-type-specific subjects in `emails/render-template.ts` (signup / magiclink / recovery / email_change / invite).

### Required env vars

- `RESEND_API_KEY` — Resend HTTP API key (`re_...`)
- `SUPABASE_AUTH_HOOK_SECRET` — Standard Webhooks signing secret (`v1,whsec_...`). Same value must be set in Supabase project config.

### Configuring the hook on Supabase

```bash
PAT=<your supabase PAT>
PROJECT_REF=tzfuboudblqdsdhhvrvs
HOOK_SECRET=$(grep '^SUPABASE_AUTH_HOOK_SECRET=' .env.test | cut -d= -f2-)

curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $PAT" \
  -H "Content-Type: application/json" \
  -d "{
    \"hook_send_email_enabled\": true,
    \"hook_send_email_uri\": \"https://ksef-invoice-translator.vercel.app/api/auth/send-email-hook\",
    \"hook_send_email_secret\": \"$HOOK_SECRET\"
  }"
```

Local dev: Supabase auth runs on `supabase.co` and can't hit `localhost:3000`. Either (a) keep the production hook URI and test via the deployed Vercel URL, or (b) tunnel with `ngrok http 3000` and temporarily point the hook at the ngrok URL.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: phase 4.5 auth-email hook"
```

---

### Task 7: Verification + advisors

This is the same final pass we did for prior phases.

- [ ] **Step 1: Full verification**

```bash
npm run typecheck
npm run build
tmux new-session -d -s next-dev "npx next dev" && sleep 6
npm test
tmux kill-session -t next-dev
```

Expected: all green.

- [ ] **Step 2: Supabase advisors**

```
mcp__supabase__get_advisors --type security
mcp__supabase__get_advisors --type performance
```

Expected: no new lints. The pre-existing `auth_leaked_password_protection` WARN is fine.

- [ ] **Step 3: No commit**

Verification task only. Any failures get their own fix commit.

---

## Verification checklist (before opening PR)

- [ ] `npm run typecheck` clean
- [ ] `npm test` — all green, including the new render-template (6), send-email-hook (5), api/send-email-hook (3) integration tests
- [ ] `npm run build` succeeds; `/api/auth/send-email-hook` appears in the route list
- [ ] Supabase advisors return no new lints
- [ ] Auth hook configured on Supabase via Management API
- [ ] Manual end-to-end: sign in via `/login` with a real email you control, magic-link arrives from `auth@<host>` (or `onboarding@resend.dev` in sandbox), HTML renders in the language matching the user's `profiles.locale`, clicking the link signs you in normally

---

## What comes next

Phase 5 (history page) is the natural follow-up. Email infrastructure is now in place for future needs:
- Phase 5 doesn't depend on this; it's UI on top of existing data.
- Future transactional emails (purchase receipt, low-credit warning) can reuse `emails/render-template.ts` as a base.
