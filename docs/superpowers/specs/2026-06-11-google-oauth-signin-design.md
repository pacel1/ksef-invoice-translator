# "Continue with Google" sign-in

**Status:** Spec
**Date:** 2026-06-11
**Approach:** Standard OAuth redirect via Supabase (`signInWithOAuth`)
**Scope:** One button on the existing login page (PL + EN), provider configuration, no new pages

---

## 1. Goal & context

Let users register and sign in with their Google account. Today the only auth method is a passwordless magic link (`signInWithOtp` in `app/login/login-form.tsx`). There is no separate registration page: an account is created automatically on first sign-in, and a `profiles` row is provisioned by the `on_auth_user_created` trigger (`supabase/migrations/20260513000002_profile_bootstrap.sql`).

Because registration is implicit, a single "Continue with Google" button on the login page covers both "Register with Google" and "Sign in with Google".

### Non-goals

- A separate `/register` page
- Google One Tap / embedded Google Identity Services button (`signInWithIdToken`)
- Prefilling `first_name` / `last_name` from Google profile metadata. The onboarding name modal stays for everyone, including Google users. The `handle_new_user()` trigger is not touched.
- Other social providers (Apple, Microsoft, etc.)

---

## 2. User flow

1. User opens `/login` (PL) or `/en/login` (EN). Above the magic-link email form they see a "Continue with Google" button, separated from the form by an "or" divider.
2. Clicking the button calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: <origin>/auth/callback } })` on the browser client (`lib/supabase/browser.ts`). The callback already defaults its post-login redirect to `/app`, so no `redirect_to` param is needed.
3. The browser is redirected to Google's consent screen, then back to Supabase (`https://<project-ref>.supabase.co/auth/v1/callback`), then to the app's existing callback `app/auth/callback/route.ts` with `?code=`.
4. The callback's existing PKCE branch (`exchangeCodeForSession`) creates the session and redirects to `/app`. **No changes to the callback route are expected.**
5. First-time users get a `profiles` row from the existing trigger and see the onboarding name modal in `/app`, exactly like magic-link users.

### Account linking

Supabase automatically links identities that share a verified email address. Google emails are verified, so an existing magic-link user who signs in with Google ends up in the same account with two linked identities, not a duplicate account. No code is needed; this is documented here so it is a known, intended behavior.

---

## 3. Code changes

### 3.1 `app/login/login-form.tsx`

- Add a "Continue with Google" button above the email form and an "or" divider between them.
- The button click handler calls `signInWithOAuth` as in §2. While the call is in flight the button is disabled (pending state). `signInWithOAuth` resolves before navigation, so the pending state mainly guards against double clicks.
- If `signInWithOAuth` returns an error (misconfiguration, network), render an inline error message in the same place the magic-link error renders today. The email form must remain usable.
- Extend the `LoginFormCopy` interface with the new keys (button label, divider label, Google error message).
- Use the standard Google "G" logo mark on the button per Google's brand guidelines (inline SVG, no new dependency).

### 3.2 `lib/marketing/copy.ts`

New keys in both `pl.login` and `en.login` blocks. Proposed copy (no dashes, natural register, consistent with existing login copy):

| Key | PL | EN |
| --- | --- | --- |
| `googleButton` | `Kontynuuj przez Google` | `Continue with Google` |
| `divider` | `albo` | `or` |
| `googleError` | `Nie udało się połączyć z Google. Spróbuj ponownie albo użyj linku e-mail.` | `Could not connect to Google. Try again or use the email link.` |

### 3.3 `supabase/config.toml`

Add a Google block (mirrors the disabled Apple block at lines 211–217):

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
redirect_uri = "http://127.0.0.1:54321/auth/v1/callback"
```

### 3.4 Environment variables

Add to `.env.example` (values blank) and `.env.local` (real values, never committed):

```
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=
```

The local Supabase stack reads these on `supabase start` / `supabase db reset` via the `env(...)` references in `config.toml`.

---

## 4. Google Cloud Console walkthrough (manual, one time)

1. Go to <https://console.cloud.google.com/> and create a project (or pick an existing one), e.g. `ksef-invoice-translator`.
2. **OAuth consent screen** (APIs & Services → OAuth consent screen, now branded "Google Auth Platform"):
   - User type: **External**.
   - App name: the product name shown on the consent screen (e.g. "Tłumacz Faktur KSeF").
   - Support email and developer contact: your address.
   - Scopes: the defaults are enough; Supabase requests `openid email profile`. No sensitive scopes, so no Google verification review is required.
   - While the app is in **Testing** status only listed test users can sign in. Add your own address as a test user for development, then **Publish** the app before launch.
3. **Credentials** (APIs & Services → Credentials → Create credentials → **OAuth client ID**):
   - Application type: **Web application**.
   - Name: e.g. `supabase-auth`.
   - Authorized JavaScript origins:
     - `https://<production-domain>`
     - `http://localhost:3000`
   - Authorized redirect URIs:
     - `https://<project-ref>.supabase.co/auth/v1/callback` (hosted Supabase; the project ref is visible via `supabase projects list`)
     - `http://127.0.0.1:54321/auth/v1/callback` (local Supabase stack)
4. Copy the generated **Client ID** and **Client secret** into the env vars from §3.4.

---

## 5. Hosted Supabase configuration (no dashboard)

Per the project tooling rule, the hosted project is configured via CLI or Management API only:

- **Preferred:** `supabase config push` from the repo root pushes the `[auth.external.google]` block from `config.toml` to the linked project, resolving the `env(...)` references from the local environment. Requires a CLI version that supports `config push`; upgrade the dev dependency if the pinned version does not.
- **Fallback:** Management API:

  ```
  PATCH https://api.supabase.com/v1/projects/<project-ref>/config/auth
  { "external_google_enabled": true,
    "external_google_client_id": "...",
    "external_google_secret": "..." }
  ```

The hosted project's redirect allow-list already contains the production `/auth/callback` URL (magic links use it today), so no change is expected there. Verify during rollout.

---

## 6. Error handling

| Failure | Behavior |
| --- | --- |
| `signInWithOAuth` returns an error before redirect | Inline `googleError` message on the form; email form still usable |
| User cancels on Google's consent screen | Google redirects back with an error; Supabase forwards to our callback without a valid `code`; callback redirects to `/login?error=...` which the page already renders |
| Code exchange fails in the callback | Existing behavior: redirect to `/login?error=...` |

No new error pages or states beyond the one inline message.

---

## 7. Testing

TDD throughout; tests written before implementation.

**Unit / component (Vitest, `tests/components/marketing/login-form.test.tsx`):**

- Google button renders with the PL and EN copy.
- Clicking the button calls `signInWithOAuth` with `provider: "google"` and a `redirectTo` pointing at `<origin>/auth/callback`.
- Button is disabled while the call is pending.
- An error from `signInWithOAuth` renders the `googleError` copy and the email form remains interactive.
- Existing magic-link tests keep passing unchanged.

**E2E (Playwright, `tests/e2e/auth.spec.ts`):**

- Clicking the Google button navigates toward the Supabase authorize endpoint (`/auth/v1/authorize?provider=google`). The real Google consent screen cannot be driven in CI, so the assertion stops at the outgoing redirect.
- Existing magic-link and route-guard specs keep passing.

**Manual verification checklist (staging/production, once credentials exist):**

1. Fresh Google account → full round trip lands on `/app`, profile row exists, onboarding modal appears.
2. Existing magic-link user signs in with Google using the same email → same account, no duplicate, credits intact.
3. Cancel on the consent screen → back on `/login` with a readable error.
4. Both locales show correct copy.

---

## 8. Rollout order

1. Land code changes (button, copy, config.toml, env example) behind nothing; the button simply errors gracefully until the provider is configured.
2. Create Google credentials (§4), set env vars locally, verify the full flow against the local stack.
3. Push provider config to the hosted project (§5) and run the manual checklist.
