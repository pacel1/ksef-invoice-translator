# "Continue with Google" Sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Continue with Google" OAuth button to the existing login page (PL + EN) using Supabase `signInWithOAuth`, per the approved spec `docs/superpowers/specs/2026-06-11-google-oauth-signin-design.md`.

**Architecture:** The shared `LoginForm` client component gains a Google button and an "or" divider above the magic-link email form. Clicking calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: <origin>/auth/callback } })`; the existing `/auth/callback` PKCE branch handles the return trip unchanged. Provider credentials flow through `supabase/config.toml` `env(...)` substitution locally and `supabase config push` / Management API for the hosted project.

**Tech Stack:** Next.js 15 App Router, React 19, `@supabase/ssr` + `@supabase/supabase-js`, Vitest + Testing Library (jsdom), Playwright.

**Branch:** `claude/google-oauth-signin` (already created off `origin/main`; spec committed as `68eee9e`).

---

## File structure

| File | Action | Responsibility |
| --- | --- | --- |
| `components/auth/google-icon.tsx` | Create | Standalone Google "G" logo SVG (brand colors), decorative |
| `app/login/login-form.tsx` | Modify | Google button, divider, OAuth pending/error state; extend `LoginFormCopy` |
| `lib/marketing/copy.ts` | Modify | New `googleButton` / `divider` / `googleError` keys in `pl.login` (~line 186) and `en.login` (~line 400) |
| `tests/components/marketing/login-form.test.tsx` | Modify | New tests; extend mock with `signInWithOAuth` |
| `tests/e2e/auth.spec.ts` | Modify | Outgoing-redirect assertion for the Google button |
| `supabase/config.toml` | Modify | `[auth.external.google]` block after the Apple block (line ~222) |
| `.env.example` | Modify | Document the two new env vars |

No changes to `app/login/page.tsx`, `app/en/login/page.tsx` (they already pass the whole `login` copy block to `LoginForm`; TypeScript structural typing picks up the new required keys automatically), or `app/auth/callback/route.ts`.

---

### Task 1: Google button and divider render

**Files:**
- Modify: `tests/components/marketing/login-form.test.tsx`
- Modify: `app/login/login-form.tsx` (interface + markup)
- Modify: `lib/marketing/copy.ts`
- Create: `components/auth/google-icon.tsx`

- [ ] **Step 1: Write the failing test**

In `tests/components/marketing/login-form.test.tsx`:

Add the three new keys to `baseCopy` (after `errorRateLimited`):

```ts
const baseCopy = {
  emailLabel: "Adres e-mail",
  emailPlaceholder: "twoj@adres.pl",
  submitButton: "Wyślij link logowania",
  sendingButton: "Wysyłam link…",
  sentTitle: "Sprawdź skrzynkę",
  sentBodyPrefix: "Link logowania wysłany na",
  sentResend: "Wyślij ponownie",
  errorGeneric: "Nie udało się wysłać linku. Spróbuj ponownie.",
  errorRateLimited: "Za dużo prób.",
  googleButton: "Kontynuuj przez Google",
  divider: "albo",
  googleError: "Nie udało się połączyć z Google. Spróbuj ponownie albo użyj linku e-mail."
};
```

Extend the Supabase mock with `signInWithOAuth` (replace the existing `vi.mock` block and mock declarations):

```ts
const signInWithOtpMock = vi.fn();
const signInWithOAuthMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithOtp: signInWithOtpMock, signInWithOAuth: signInWithOAuthMock }
  })
}));

beforeEach(() => {
  signInWithOtpMock.mockReset();
  signInWithOAuthMock.mockReset();
});

afterEach(() => {
  signInWithOtpMock.mockReset();
  signInWithOAuthMock.mockReset();
});
```

Add inside `describe("<LoginForm>")`:

```tsx
it("renders the Google button and divider above the email form", () => {
  render(<LoginForm copy={baseCopy} />);
  expect(screen.getByRole("button", { name: /Kontynuuj przez Google/i })).toBeInTheDocument();
  expect(screen.getByText("albo")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/marketing/login-form.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "button" and name /Kontynuuj przez Google/i`. The four pre-existing tests must still PASS.

- [ ] **Step 3: Create the Google icon component**

Create `components/auth/google-icon.tsx`:

```tsx
/** Google "G" mark in official brand colors. Decorative only. */
export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Add copy keys to both locales**

In `lib/marketing/copy.ts`, `pl.login` block — add after `errorRateLimited` (line ~186):

```ts
      errorRateLimited: "Za dużo prób. Odczekaj chwilę i spróbuj jeszcze raz.",
      googleButton: "Kontynuuj przez Google",
      divider: "albo",
      googleError: "Nie udało się połączyć z Google. Spróbuj ponownie albo użyj linku e-mail."
```

In `en.login` block — add after `errorRateLimited` (line ~400):

```ts
      errorRateLimited: "Too many attempts. Please wait a moment and try again.",
      googleButton: "Continue with Google",
      divider: "or",
      googleError: "Could not connect to Google. Try again or use the email link."
```

- [ ] **Step 5: Render the button and divider in `LoginForm`**

In `app/login/login-form.tsx`:

Extend the interface:

```ts
export interface LoginFormCopy {
  emailLabel: string;
  emailPlaceholder: string;
  submitButton: string;
  sendingButton: string;
  sentTitle: string;
  sentBodyPrefix: string;
  sentResend: string;
  errorGeneric: string;
  errorRateLimited: string;
  googleButton: string;
  divider: string;
  googleError: string;
}
```

Add the import:

```ts
import { GoogleIcon } from "@/components/auth/google-icon";
```

Wrap the returned `<form>` in a `<div>` with the button and divider above it (the `sent` early-return stays untouched). The final JSX of the idle/error branch:

```tsx
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-small font-semibold text-text-strong shadow-sm transition-colors duration-hover ease-out hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleIcon className="h-4 w-4" />
        {copy.googleButton}
      </button>
      <div className="flex items-center gap-3 text-small text-text-muted">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        {copy.divider}
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {/* existing form contents unchanged */}
      </form>
    </div>
  );
```

(The comment is shorthand for this plan only — keep the existing label/input/submit/error JSX exactly as it is today, nested inside the form.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/components/marketing/login-form.test.tsx`
Expected: all 5 tests PASS.

Run: `npm run typecheck`
Expected: clean. This also proves both `pl.login` and `en.login` satisfy the extended `LoginFormCopy` (the login pages pass the whole block as the `copy` prop).

- [ ] **Step 7: Commit**

```bash
git add components/auth/google-icon.tsx app/login/login-form.tsx lib/marketing/copy.ts tests/components/marketing/login-form.test.tsx
git commit -m "feat(auth): render Continue with Google button on login form"
```

---

### Task 2: Clicking the button starts the OAuth redirect

**Files:**
- Modify: `tests/components/marketing/login-form.test.tsx`
- Modify: `app/login/login-form.tsx`

- [ ] **Step 1: Write the failing tests**

Add inside `describe("<LoginForm>")`:

```tsx
it("starts Google OAuth with the google provider and callback redirect", async () => {
  signInWithOAuthMock.mockResolvedValue({ error: null });
  render(<LoginForm copy={baseCopy} />);
  fireEvent.click(screen.getByRole("button", { name: /Kontynuuj przez Google/i }));
  await waitFor(() => {
    expect(signInWithOAuthMock).toHaveBeenCalledTimes(1);
  });
  const args = signInWithOAuthMock.mock.calls[0][0];
  expect(args.provider).toBe("google");
  expect(args.options.redirectTo).toBe(`${window.location.origin}/auth/callback`);
});

it("disables the Google button while the OAuth call is pending", async () => {
  signInWithOAuthMock.mockReturnValue(new Promise(() => {}));
  render(<LoginForm copy={baseCopy} />);
  const button = screen.getByRole("button", { name: /Kontynuuj przez Google/i });
  fireEvent.click(button);
  await waitFor(() => {
    expect(button).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/marketing/login-form.test.tsx`
Expected: the two new tests FAIL (`signInWithOAuthMock` never called; button never disabled). The five earlier tests PASS.

- [ ] **Step 3: Implement the click handler**

In `app/login/login-form.tsx`:

Add a second state next to `status`:

```ts
type GoogleStatus = "idle" | "pending" | "error";
```

```ts
const [googleStatus, setGoogleStatus] = useState<GoogleStatus>("idle");
```

Add the handler next to `submit`:

```ts
async function signInWithGoogle() {
  setGoogleStatus("pending");
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` }
  });
  if (error) {
    setGoogleStatus("error");
  }
  // On success the browser is being redirected to Google; stay pending.
}
```

Wire the button:

```tsx
<button
  type="button"
  onClick={signInWithGoogle}
  disabled={googleStatus === "pending"}
  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-small font-semibold text-text-strong shadow-sm transition-colors duration-hover ease-out hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
>
  {googleStatus === "pending" ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <GoogleIcon className="h-4 w-4" />
  )}
  {copy.googleButton}
</button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/marketing/login-form.test.tsx`
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/login/login-form.tsx tests/components/marketing/login-form.test.tsx
git commit -m "feat(auth): start Google OAuth flow from the login form"
```

---

### Task 3: OAuth error state keeps the email form usable

**Files:**
- Modify: `tests/components/marketing/login-form.test.tsx`
- Modify: `app/login/login-form.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("shows the Google error and keeps the email form usable", async () => {
  signInWithOAuthMock.mockResolvedValue({ error: { message: "boom", status: 500 } });
  signInWithOtpMock.mockResolvedValue({ error: null });
  render(<LoginForm copy={baseCopy} />);

  fireEvent.click(screen.getByRole("button", { name: /Kontynuuj przez Google/i }));
  await waitFor(() => {
    expect(screen.getByText(/Nie udało się połączyć z Google/i)).toBeInTheDocument();
  });

  fireEvent.change(screen.getByLabelText(/Adres e-mail/i), {
    target: { value: "test@firma.pl" }
  });
  fireEvent.click(screen.getByRole("button", { name: /Wyślij link logowania/i }));
  await waitFor(() => {
    expect(screen.getByText(/Sprawdź skrzynkę/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/marketing/login-form.test.tsx`
Expected: new test FAILS — the `googleError` copy is not rendered (Task 2's handler sets the state but nothing displays it yet).

- [ ] **Step 3: Render the error message**

In `app/login/login-form.tsx`, directly under the Google button (above the divider):

```tsx
{googleStatus === "error" ? (
  <p className="text-small text-danger">{copy.googleError}</p>
) : null}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/marketing/login-form.test.tsx`
Expected: all 8 tests PASS.

Run the full unit suite to catch regressions: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/login/login-form.tsx tests/components/marketing/login-form.test.tsx
git commit -m "feat(auth): inline error state for failed Google OAuth start"
```

---

### Task 4: E2E — Google button issues the authorize redirect

**Files:**
- Modify: `tests/e2e/auth.spec.ts`

The real Google consent screen cannot be driven in CI, so the test stops at the outgoing redirect to Supabase's authorize endpoint and fulfills it with a stub. Uses the `base` test import (no `testUser` fixture needed).

- [ ] **Step 1: Write the test**

Append to `tests/e2e/auth.spec.ts`:

```ts
base("Google button redirects to the Supabase authorize endpoint", async ({ page }) => {
  // Keep the test hermetic: never leave for Google, just capture the redirect.
  await page.route(/\/auth\/v1\/authorize/, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "ok" })
  );

  await page.goto("/login");
  const authorizeRequest = page.waitForRequest(/\/auth\/v1\/authorize/);
  await page.getByRole("button", { name: /Kontynuuj przez Google/i }).click();

  const url = new URL((await authorizeRequest).url());
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toMatch(/\/auth\/callback$/);
});
```

(`base` and `expect` are already imported at the top of this file.)

- [ ] **Step 2: Run the e2e spec**

Prerequisite: local Supabase stack running (`npm run db:start`). Playwright auto-starts the dev server.

Run: `npx playwright test tests/e2e/auth.spec.ts`
Expected: all 3 tests in the file PASS (the new one plus the two existing).

Note: this test passes even before the Google provider is configured, because `signInWithOAuth` builds the authorize URL client-side (PKCE) and the route is intercepted before Supabase answers.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/auth.spec.ts
git commit -m "test(e2e): assert Google button issues Supabase authorize redirect"
```

---

### Task 5: Supabase provider config + env documentation

**Files:**
- Modify: `supabase/config.toml` (insert after the `[auth.external.apple]` block, line ~222)
- Modify: `.env.example`

- [ ] **Step 1: Add the Google provider block to `supabase/config.toml`**

Insert between the `[auth.external.apple]` block and the `[auth.third_party.firebase]` block:

```toml
[auth.external.google]
# Disabled by default so the local stack boots without Google credentials:
# the CLI hard-errors on unset env() vars when a provider is enabled.
# To test Google sign-in locally, set both env vars and flip this to true.
# Enabling the hosted project happens at rollout by committing this flip
# and running `supabase config push` (see the design spec, section 5).
enabled = false
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
# Local Supabase auth callback. The hosted project uses
# https://<project-ref>.supabase.co/auth/v1/callback automatically.
redirect_uri = "http://127.0.0.1:54321/auth/v1/callback"
# If local Google sign-in fails with a nonce mismatch, set to true locally
# only. Never push skip_nonce_check = true to the hosted project.
skip_nonce_check = false
```

Correction discovered during execution: on CLI v1.226.4 an enabled provider with unset `env(...)` vars hard-errors and blocks `supabase start`. The committed default is therefore `enabled = false`; flipping it to true (with env vars set) is part of the manual rollout.

- [ ] **Step 2: Document env vars in `.env.example`**

Append:

```
# ── Google OAuth (Supabase auth provider) ──────────────────────────────
# From Google Cloud Console → APIs & Services → Credentials → OAuth client
# (Web application). Consumed by supabase/config.toml env() substitution for
# the local stack and by `supabase config push` for the hosted project.
# Server-side only, never expose to the browser.
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=
```

- [ ] **Step 3: Verify the local stack still boots**

Run: `npm run db:start` (or `supabase stop && supabase start` if already running)
Expected: stack starts cleanly. With the provider disabled the CLI never evaluates the Google `env(...)` references, so unset vars produce no warning or error.

- [ ] **Step 4: Commit**

```bash
git add supabase/config.toml .env.example
git commit -m "chore(auth): Google OAuth provider config and env scaffolding"
```

---

### Task 6: Full verification and PR

- [ ] **Step 1: Run the complete verification suite**

```bash
npm run typecheck
npm run lint
npm test
npx playwright test tests/e2e/auth.spec.ts
```

Expected: all clean/passing. Fix anything that fails before proceeding.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin claude/google-oauth-signin
gh pr create --title "feat(auth): Continue with Google sign-in" --body "$(cat <<'EOF'
## Summary
- "Continue with Google" button on /login and /en/login above the magic-link form (PL/EN copy, no dashes)
- Supabase signInWithOAuth PKCE flow through the existing /auth/callback route (callback unchanged)
- [auth.external.google] in supabase/config.toml with env() credentials; .env.example documents the new vars
- Existing magic-link users signing in with Google get the same account (Supabase links verified-email identities)

Spec: docs/superpowers/specs/2026-06-11-google-oauth-signin-design.md
Plan: docs/superpowers/plans/2026-06-11-google-oauth-signin.md

## Test plan
- [x] Vitest: button renders (PL), OAuth call args, pending disable, inline error + email form stays usable
- [x] Playwright: Google button issues /auth/v1/authorize redirect with provider=google
- [ ] Manual (needs Google credentials, see Rollout below): full round trip on local stack
- [ ] Manual staging checklist from spec §7 after hosted config push

## Rollout (manual, after merge)
1. Google Cloud Console: consent screen + Web OAuth client per spec §4; set SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID/SECRET locally
2. Verify full flow against the local stack
3. Push provider config to hosted project per spec §5 (supabase config push or Management API; no dashboard)
EOF
)"
```

- [ ] **Step 3: Hand off**

Report the PR URL. The Google Cloud walkthrough (spec §4) and hosted config push (spec §5) are manual follow-ups for the user since they require the Google account owner.

---

## Out of scope (per spec)

- No changes to `handle_new_user()` trigger (no name prefill)
- No One Tap / `signInWithIdToken`
- No separate register page
- No changes to `app/auth/callback/route.ts`
