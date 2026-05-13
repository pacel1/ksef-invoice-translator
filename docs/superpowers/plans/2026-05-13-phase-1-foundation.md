# KSeF SaaS Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the SaaS foundation — Supabase project, complete DB schema with RLS, all credit-related SQL functions, magic-link auth, and a protected `/app` shell — without yet migrating the existing translator workspace into it. After this phase the existing anonymous translator at `/` still works exactly as before; logged-in users can land on `/app` but see only a placeholder.

**Architecture:** The existing Next.js 15 App Router app gains Supabase auth via `@supabase/ssr` cookies + Next middleware. All future tables are created up front in one migration set so subsequent phases focus on application code only. Tests run against a local Supabase stack (`supabase start`) using Vitest for SQL + unit tests and Playwright with Supabase's local Inbucket SMTP for the end-to-end magic-link flow.

**Tech Stack:** Next.js 15, TypeScript, Supabase (Postgres, Auth, CLI for migrations), `@supabase/ssr`, `@supabase/supabase-js`, Vitest, Playwright. No new hosting requirements.

**Out of scope for this phase:** moving the translator into `/app`, persistence of invoices, credit enforcement at upload time, Stripe, history page, frontend polish, i18n lift. Those are Phases 2–6.

---

## File Structure

### New files

- `supabase/config.toml` — Supabase local-dev config
- `supabase/migrations/20260513000001_profiles.sql`
- `supabase/migrations/20260513000002_profile_bootstrap.sql`
- `supabase/migrations/20260513000003_credit_balances.sql`
- `supabase/migrations/20260513000004_invoices.sql`
- `supabase/migrations/20260513000005_translations.sql`
- `supabase/migrations/20260513000006_credit_ledger.sql`
- `supabase/migrations/20260513000007_stripe_purchases.sql`
- `supabase/migrations/20260513000008_rls_policies.sql`
- `supabase/migrations/20260513000009_credit_functions.sql`
- `lib/supabase/browser.ts` — browser SSR client
- `lib/supabase/server.ts` — RSC/route-handler server client
- `lib/supabase/admin.ts` — service-role client (never imported by client code)
- `lib/supabase/middleware.ts` — session refresh helper used by Next middleware
- `lib/auth/require-user.ts` — server util that throws/redirects if no session
- `middleware.ts` — Next middleware (root level)
- `app/login/page.tsx` — server component shell
- `app/login/login-form.tsx` — client component, the form itself
- `app/auth/callback/route.ts` — magic-link exchange endpoint
- `app/(protected)/layout.tsx` — protected route group layout with header
- `app/(protected)/app/page.tsx` — placeholder workspace
- `app/(protected)/account/page.tsx` — basic account info + sign out
- `app/actions/auth.ts` — `signOut` server action
- `vitest.config.ts`
- `playwright.config.ts`
- `tests/setup/env.ts` — loads `.env.test`
- `tests/integration/sql/credit-functions.test.ts`
- `tests/e2e/auth.spec.ts`
- `.env.test.example`

### Modified files

- `package.json` — new deps, new scripts
- `.gitignore` — Supabase + Playwright artefacts
- `.env.example` — Supabase env vars
- `app/page.tsx` — header gains a "Sign in" CTA pointing to `/login`; no other changes
- `README.md` — local dev now requires `supabase start`

### Files intentionally NOT touched in this phase

- `app/api/parse-pdf/route.ts`, `app/api/translate/route.ts`, `app/api/pdf/route.ts` — existing anonymous endpoints stay as-is. They move in Phase 2.
- `components/invoice-preview.tsx`, `lib/translation/*`, `lib/pdf/*`, `lib/xml/*`, `lib/invoice/*` — unchanged.

---

## Tasks

### Task 1: Add tooling deps and scripts

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add runtime + dev deps**

Edit `package.json` `dependencies`:

```json
"@supabase/ssr": "^0.5.2",
"@supabase/supabase-js": "^2.45.4"
```

Edit `package.json` `devDependencies`:

```json
"@playwright/test": "^1.49.0",
"@testing-library/jest-dom": "^6.5.0",
"@testing-library/react": "^16.0.1",
"@vitejs/plugin-react": "^4.3.4",
"dotenv": "^16.4.5",
"jsdom": "^25.0.1",
"supabase": "^1.219.2",
"vitest": "^2.1.5"
```

- [ ] **Step 2: Add scripts**

Add to `package.json` `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:integration": "vitest run --config vitest.config.ts tests/integration",
"test:e2e": "playwright test",
"test:e2e:install": "playwright install --with-deps chromium",
"db:start": "supabase start",
"db:stop": "supabase stop",
"db:reset": "supabase db reset",
"db:diff": "supabase db diff",
"db:push": "supabase db push",
"db:types": "supabase gen types typescript --local > lib/supabase/database.types.ts"
```

- [ ] **Step 3: Update .gitignore**

Append:

```
# Supabase
supabase/.branches
supabase/.temp

# Playwright
test-results
playwright-report
playwright/.cache

# Test envs
.env.test
.env.local
```

- [ ] **Step 4: Install**

Run: `npm install`
Expected: install succeeds. No warnings about peer deps for `@supabase/ssr`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: add supabase, vitest, playwright tooling"
```

---

### Task 2: Document and template environment variables

**Files:**
- Modify: `.env.example`
- Create: `.env.test.example`

- [ ] **Step 1: Update .env.example**

Replace contents of `.env.example` with:

```
# Existing
OPENAI_API_KEY=
OPENAI_TRANSLATION_MODEL=

# Supabase (public)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Supabase (server-only, never expose to the browser)
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 2: Create .env.test.example**

```
# Filled in by `supabase status` after `npm run db:start`.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 3: Commit**

```bash
git add .env.example .env.test.example
git commit -m "chore: env templates for supabase"
```

---

### Task 3: Initialize Supabase local project

**Files:**
- Create: `supabase/config.toml`

- [ ] **Step 1: Run `supabase init`**

Run: `npx supabase init`
Expected: creates `supabase/config.toml`, `supabase/seed.sql` (we will ignore seed), and `.gitignore` entries. If prompted about VS Code settings, answer "n".

- [ ] **Step 2: Pin local ports and enable Inbucket**

Open `supabase/config.toml` and ensure these blocks (edit values that differ; leave others as the generated defaults):

```toml
project_id = "ksef-invoice-translator"

[api]
enabled = true
port = 54321

[db]
port = 54322

[studio]
enabled = true
port = 54323

[inbucket]
enabled = true
port = 54324
smtp_port = 54325
pop3_port = 54326

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/auth/callback"]
jwt_expiry = 3600
enable_signup = true

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false
```

- [ ] **Step 3: Boot the local stack**

Run: `npm run db:start`
Expected: prints API URL, DB URL, Studio URL, Inbucket URL, anon key, service-role key.

- [ ] **Step 4: Capture local keys**

Run: `npx supabase status`
Copy the `anon key` and `service_role key` printed values into a new local file `.env.test` (not committed):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste anon>
SUPABASE_SERVICE_ROLE_KEY=<paste service_role>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Also copy these values into `.env.local` for `next dev`.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml
git commit -m "chore: supabase local config"
```

---

### Task 4: Test infrastructure — Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup/env.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/setup/env.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 15_000
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
```

- [ ] **Step 2: Create `tests/setup/env.ts`**

```ts
import "dotenv/config";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.test") });

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required test env var: ${key}. Did you run 'npm run db:start' and copy keys into .env.test?`);
  }
}
```

- [ ] **Step 3: Smoke test that Vitest runs**

Create `tests/setup/env.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("test env", () => {
  it("has supabase env vars loaded", () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toMatch(/^http/);
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run**

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/
git commit -m "test: vitest setup with env loader"
```

---

### Task 5: Test infrastructure — Playwright

**Files:**
- Create: `playwright.config.ts`

- [ ] **Step 1: Install browsers**

Run: `npm run test:e2e:install`
Expected: Chromium downloads.

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
```

- [ ] **Step 3: Smoke spec**

Create `tests/e2e/smoke.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/.+/);
});
```

- [ ] **Step 4: Run**

In one terminal: `npm run dev`.
In another: `npm run test:e2e -- smoke`.
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/smoke.spec.ts
git commit -m "test: playwright config and smoke spec"
```

---

### Task 6: Migration — profiles table

**Files:**
- Create: `supabase/migrations/20260513000001_profiles.sql`
- Test: `tests/integration/sql/profiles.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/integration/sql/profiles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("profiles table", () => {
  it("accepts a row with default locale 'pl' for a real auth user", async () => {
    const email = `prof-${Date.now()}@example.test`;
    const { data: user } = await admin.auth.admin.createUser({ email, email_confirm: true });
    const userId = user.user!.id;

    // Trigger from Task 7 may or may not have inserted the row yet — upsert handles both cases.
    const { error: upsertError } = await admin.from("profiles").upsert({ id: userId, email });
    expect(upsertError).toBeNull();

    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, locale")
      .eq("id", userId)
      .single();
    expect(profile?.email).toBe(email);
    expect(profile?.locale).toBe("pl");

    await admin.auth.admin.deleteUser(userId);
  });

  it("rejects an invalid locale", async () => {
    const email = `prof-bad-${Date.now()}@example.test`;
    const { data: user } = await admin.auth.admin.createUser({ email, email_confirm: true });
    const userId = user.user!.id;

    const { error } = await admin.from("profiles").update({ locale: "de" }).eq("id", userId);
    expect(error?.message ?? "").toMatch(/check constraint|violates/);

    await admin.auth.admin.deleteUser(userId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:integration -- profiles`
Expected: FAIL — table does not exist.

- [ ] **Step 3: Write migration**

Create `supabase/migrations/20260513000001_profiles.sql`:

```sql
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  locale       text not null default 'pl' check (locale in ('pl', 'en')),
  created_at   timestamptz not null default now()
);

comment on table public.profiles is 'One row per authenticated user; mirrors auth.users for app-level fields.';

alter table public.profiles enable row level security;
```

- [ ] **Step 4: Apply and re-run**

Run: `npm run db:reset`
Expected: migration applies cleanly.

Run: `npm run test:integration -- profiles`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260513000001_profiles.sql tests/integration/sql/profiles.test.ts
git commit -m "feat(db): profiles table"
```

---

### Task 7: Migration — profile bootstrap trigger

**Files:**
- Create: `supabase/migrations/20260513000002_profile_bootstrap.sql`
- Test: `tests/integration/sql/profile-bootstrap.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("profile bootstrap trigger", () => {
  it("inserts a profile row when a user signs up", async () => {
    const email = `test-${Date.now()}@example.test`;
    const { data: user, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true
    });
    expect(error).toBeNull();
    const userId = user.user!.id;

    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, locale")
      .eq("id", userId)
      .single();

    expect(profile).toEqual({ id: userId, email, locale: "pl" });

    await admin.auth.admin.deleteUser(userId);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm run test:integration -- profile-bootstrap`
Expected: FAIL — `profile` is null.

- [ ] **Step 3: Write migration**

Create `supabase/migrations/20260513000002_profile_bootstrap.sql`:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 4: Apply and re-run**

Run: `npm run db:reset`
Run: `npm run test:integration -- profile-bootstrap`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260513000002_profile_bootstrap.sql tests/integration/sql/profile-bootstrap.test.ts
git commit -m "feat(db): bootstrap profile on auth.users insert"
```

---

### Task 8: Migration — credit_balances table

**Files:**
- Create: `supabase/migrations/20260513000003_credit_balances.sql`
- Test: `tests/integration/sql/credit-balances.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("credit_balances table", () => {
  it("has expected columns and check constraints", async () => {
    const email = `cb-${Date.now()}@example.test`;
    const { data: user } = await admin.auth.admin.createUser({ email, email_confirm: true });
    const userId = user.user!.id;

    const { error: insertError } = await admin
      .from("credit_balances")
      .insert({ user_id: userId, paid_credits: 0, free_credits_remaining: 0 });
    expect(insertError).toBeNull();

    const { error: negError } = await admin
      .from("credit_balances")
      .update({ paid_credits: -1 })
      .eq("user_id", userId);
    expect(negError?.message ?? "").toMatch(/check constraint|violates/);

    await admin.auth.admin.deleteUser(userId);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm run test:integration -- credit-balances`
Expected: FAIL — table missing.

- [ ] **Step 3: Write migration**

```sql
create table public.credit_balances (
  user_id                   uuid primary key references public.profiles(id) on delete cascade,
  paid_credits              integer not null default 0 check (paid_credits >= 0),
  free_credits_remaining    integer not null default 0 check (free_credits_remaining >= 0),
  free_credits_period_start date    not null default date_trunc('month', now())::date,
  updated_at                timestamptz not null default now()
);

comment on table public.credit_balances is 'Denormalized current balance; ground truth lives in credit_ledger.';

alter table public.credit_balances enable row level security;
```

- [ ] **Step 4: Apply and re-run**

Run: `npm run db:reset`
Run: `npm run test:integration -- credit-balances`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260513000003_credit_balances.sql tests/integration/sql/credit-balances.test.ts
git commit -m "feat(db): credit_balances table"
```

---

### Task 9: Migration — invoices table

**Files:**
- Create: `supabase/migrations/20260513000004_invoices.sql`
- Test: `tests/integration/sql/invoices.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("invoices table", () => {
  it("enforces unique (user_id, source_hash) on live rows only", async () => {
    const { data: user } = await admin.auth.admin.createUser({
      email: `inv-${Date.now()}@example.test`,
      email_confirm: true
    });
    const userId = user.user!.id;

    const row = {
      user_id: userId,
      source_type: "xml" as const,
      source_hash: "abc123",
      source_size: 100,
      source_data: { hello: "world" }
    };

    const { data: first } = await admin.from("invoices").insert(row).select().single();
    expect(first?.id).toBeTruthy();

    const { error: dupError } = await admin.from("invoices").insert(row);
    expect(dupError?.message ?? "").toMatch(/duplicate|unique/);

    await admin.from("invoices").update({ deleted_at: new Date().toISOString() }).eq("id", first!.id);
    const { error: afterDeleteError } = await admin.from("invoices").insert(row);
    expect(afterDeleteError).toBeNull();

    await admin.auth.admin.deleteUser(userId);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm run test:integration -- invoices`
Expected: FAIL — table missing.

- [ ] **Step 3: Write migration**

```sql
create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  source_type    text not null check (source_type in ('xml', 'pdf')),
  source_hash    text not null,
  source_size    integer not null check (source_size >= 0),
  invoice_number text,
  issue_date     date,
  currency       text,
  total_gross    numeric(18, 2),
  source_data    jsonb not null,
  warnings       text[] not null default '{}',
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create unique index invoices_user_hash_live
  on public.invoices (user_id, source_hash)
  where deleted_at is null;

create index invoices_user_created_at on public.invoices (user_id, created_at desc);

alter table public.invoices enable row level security;
```

- [ ] **Step 4: Apply and re-run**

Run: `npm run db:reset`
Run: `npm run test:integration -- invoices`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260513000004_invoices.sql tests/integration/sql/invoices.test.ts
git commit -m "feat(db): invoices table with soft delete"
```

---

### Task 10: Migration — translations table

**Files:**
- Create: `supabase/migrations/20260513000005_translations.sql`
- Test: `tests/integration/sql/translations.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("translations table", () => {
  it("enforces unique (invoice_id, language, bilingual)", async () => {
    const { data: user } = await admin.auth.admin.createUser({
      email: `tr-${Date.now()}@example.test`,
      email_confirm: true
    });
    const userId = user.user!.id;

    const { data: inv } = await admin
      .from("invoices")
      .insert({
        user_id: userId,
        source_type: "xml",
        source_hash: "h",
        source_size: 1,
        source_data: {}
      })
      .select()
      .single();

    const row = {
      invoice_id: inv!.id,
      language: "en",
      bilingual: true,
      translated_data: { ok: 1 },
      used_ai: false
    };

    const { error: ok } = await admin.from("translations").insert(row);
    expect(ok).toBeNull();

    const { error: dup } = await admin.from("translations").insert(row);
    expect(dup?.message ?? "").toMatch(/duplicate|unique/);

    await admin.auth.admin.deleteUser(userId);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm run test:integration -- translations`
Expected: FAIL.

- [ ] **Step 3: Write migration**

```sql
create table public.translations (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  language        text not null,
  bilingual       boolean not null,
  translated_data jsonb not null,
  used_ai         boolean not null,
  created_at      timestamptz not null default now(),
  unique (invoice_id, language, bilingual)
);

create index translations_invoice on public.translations (invoice_id);

alter table public.translations enable row level security;
```

- [ ] **Step 4: Apply and re-run**

Run: `npm run db:reset`
Run: `npm run test:integration -- translations`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260513000005_translations.sql tests/integration/sql/translations.test.ts
git commit -m "feat(db): translations table"
```

---

### Task 11: Migration — credit_ledger table

**Files:**
- Create: `supabase/migrations/20260513000006_credit_ledger.sql`
- Test: `tests/integration/sql/credit-ledger.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("credit_ledger table", () => {
  it("rejects bad event_type", async () => {
    const { data: user } = await admin.auth.admin.createUser({
      email: `cl-${Date.now()}@example.test`,
      email_confirm: true
    });
    const userId = user.user!.id;

    const { error } = await admin.from("credit_ledger").insert({
      user_id: userId,
      event_type: "nonsense",
      delta_paid: 0,
      delta_free: 0,
      balance_paid_after: 0,
      balance_free_after: 0
    });
    expect(error?.message ?? "").toMatch(/check constraint|violates/);

    await admin.auth.admin.deleteUser(userId);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm run test:integration -- credit-ledger`
Expected: FAIL.

- [ ] **Step 3: Write migration**

```sql
create table public.credit_ledger (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  event_type          text not null check (event_type in ('purchase', 'consume', 'free_grant', 'refund', 'adjustment')),
  delta_paid          integer not null default 0,
  delta_free          integer not null default 0,
  balance_paid_after  integer not null check (balance_paid_after >= 0),
  balance_free_after  integer not null check (balance_free_after >= 0),
  invoice_id          uuid references public.invoices(id) on delete set null,
  stripe_purchase_id  uuid,
  note                text,
  created_at          timestamptz not null default now()
);

create index credit_ledger_user_created on public.credit_ledger (user_id, created_at desc);

alter table public.credit_ledger enable row level security;
```

- [ ] **Step 4: Apply and re-run**

Run: `npm run db:reset`
Run: `npm run test:integration -- credit-ledger`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260513000006_credit_ledger.sql tests/integration/sql/credit-ledger.test.ts
git commit -m "feat(db): credit_ledger append-only audit log"
```

---

### Task 12: Migration — stripe_purchases table

**Files:**
- Create: `supabase/migrations/20260513000007_stripe_purchases.sql`
- Test: `tests/integration/sql/stripe-purchases.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe("stripe_purchases table", () => {
  it("rejects package_size outside [5, 100]", async () => {
    const { data: user } = await admin.auth.admin.createUser({
      email: `sp-${Date.now()}@example.test`,
      email_confirm: true
    });
    const userId = user.user!.id;

    const { error } = await admin.from("stripe_purchases").insert({
      user_id: userId,
      stripe_checkout_session_id: `cs_${Date.now()}`,
      package_size: 4,
      unit_price_cents: 699,
      total_amount_cents: 2796,
      status: "pending"
    });
    expect(error?.message ?? "").toMatch(/check constraint|violates/);

    await admin.auth.admin.deleteUser(userId);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm run test:integration -- stripe-purchases`
Expected: FAIL.

- [ ] **Step 3: Write migration**

```sql
create table public.stripe_purchases (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.profiles(id) on delete cascade,
  stripe_checkout_session_id  text unique not null,
  stripe_payment_intent_id    text unique,
  package_size                integer not null check (package_size between 5 and 100),
  unit_price_cents            integer not null check (unit_price_cents > 0),
  total_amount_cents          integer not null check (total_amount_cents > 0),
  currency                    text not null default 'pln',
  status                      text not null check (status in ('pending', 'paid', 'failed', 'refunded')),
  credits_granted             integer not null default 0 check (credits_granted >= 0),
  created_at                  timestamptz not null default now(),
  paid_at                     timestamptz
);

create index stripe_purchases_user_created on public.stripe_purchases (user_id, created_at desc);

alter table public.stripe_purchases enable row level security;

alter table public.credit_ledger
  add constraint credit_ledger_stripe_purchase_fk
  foreign key (stripe_purchase_id) references public.stripe_purchases(id) on delete set null;
```

- [ ] **Step 4: Apply and re-run**

Run: `npm run db:reset`
Run: `npm run test:integration -- stripe-purchases`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260513000007_stripe_purchases.sql tests/integration/sql/stripe-purchases.test.ts
git commit -m "feat(db): stripe_purchases table"
```

---

### Task 13: Migration — RLS policies

**Files:**
- Create: `supabase/migrations/20260513000008_rls_policies.sql`
- Test: `tests/integration/sql/rls.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function makeUser(label: string) {
  const email = `rls-${label}-${Date.now()}@example.test`;
  const password = "Test123!Test123!";
  const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const userClient = createClient(url, anon, { auth: { persistSession: false } });
  await userClient.auth.signInWithPassword({ email, password });
  return { id: created.user!.id, client: userClient };
}

describe("RLS policies", () => {
  it("user A cannot read user B's invoices", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");

    await admin.from("invoices").insert({
      user_id: b.id,
      source_type: "xml",
      source_hash: "rls-hash",
      source_size: 1,
      source_data: {}
    });

    const { data, error } = await a.client.from("invoices").select("id").eq("user_id", b.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);

    await admin.auth.admin.deleteUser(a.id);
    await admin.auth.admin.deleteUser(b.id);
  });

  it("user cannot directly write to credit_balances", async () => {
    const u = await makeUser("write");
    const { error } = await u.client.from("credit_balances").insert({
      user_id: u.id,
      paid_credits: 999,
      free_credits_remaining: 0
    });
    expect(error?.message ?? "").toMatch(/row-level security|policy/i);

    await admin.auth.admin.deleteUser(u.id);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm run test:integration -- rls`
Expected: FAIL — first assertion may pass because no policies → no access, but the second will fail because we expect policy-based denial wording. Either way, before policies the table is unusable from `anon` role, so the test surfaces the missing policies.

- [ ] **Step 3: Write migration**

```sql
-- profiles
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- credit_balances: read own; no writes (service-definer fns only)
create policy "credit_balances_select_own" on public.credit_balances
  for select using (auth.uid() = user_id);

-- invoices
create policy "invoices_select_own" on public.invoices
  for select using (auth.uid() = user_id);

create policy "invoices_insert_own" on public.invoices
  for insert with check (auth.uid() = user_id);

create policy "invoices_update_own" on public.invoices
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "invoices_delete_own" on public.invoices
  for delete using (auth.uid() = user_id);

-- translations: access via invoice ownership
create policy "translations_select_own" on public.translations
  for select using (
    exists (
      select 1 from public.invoices i
      where i.id = translations.invoice_id and i.user_id = auth.uid()
    )
  );

create policy "translations_insert_own" on public.translations
  for insert with check (
    exists (
      select 1 from public.invoices i
      where i.id = translations.invoice_id and i.user_id = auth.uid()
    )
  );

create policy "translations_update_own" on public.translations
  for update using (
    exists (
      select 1 from public.invoices i
      where i.id = translations.invoice_id and i.user_id = auth.uid()
    )
  );

create policy "translations_delete_own" on public.translations
  for delete using (
    exists (
      select 1 from public.invoices i
      where i.id = translations.invoice_id and i.user_id = auth.uid()
    )
  );

-- credit_ledger and stripe_purchases: read-own, no writes
create policy "credit_ledger_select_own" on public.credit_ledger
  for select using (auth.uid() = user_id);

create policy "stripe_purchases_select_own" on public.stripe_purchases
  for select using (auth.uid() = user_id);
```

- [ ] **Step 4: Apply and re-run**

Run: `npm run db:reset`
Run: `npm run test:integration -- rls`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260513000008_rls_policies.sql tests/integration/sql/rls.test.ts
git commit -m "feat(db): row-level security policies for all user tables"
```

---

### Task 14: Migration — credit functions

**Files:**
- Create: `supabase/migrations/20260513000009_credit_functions.sql`
- Test: `tests/integration/sql/credit-functions.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function newUser(label: string) {
  const email = `cf-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  // No credit_balances pre-insert — the SQL functions own creation of that row so we exercise the real path.
  return data.user!.id;
}

describe("credit functions", () => {
  it("ensure_free_credit_for_period grants 1 once per month", async () => {
    const userId = await newUser("free");
    await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
    let { data: bal } = await admin.from("credit_balances").select("*").eq("user_id", userId).single();
    expect(bal?.free_credits_remaining).toBe(1);

    await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
    ({ data: bal } = await admin.from("credit_balances").select("*").eq("user_id", userId).single());
    expect(bal?.free_credits_remaining).toBe(1);

    await admin.auth.admin.deleteUser(userId);
  });

  it("consume_credit prefers free, then paid, raises on zero", async () => {
    const userId = await newUser("consume");
    await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
    await admin.from("credit_balances").update({ paid_credits: 2 }).eq("user_id", userId);

    const { data: inv1 } = await admin
      .from("invoices")
      .insert({ user_id: userId, source_type: "xml", source_hash: "h1", source_size: 1, source_data: {} })
      .select()
      .single();
    const { error: e1 } = await admin.rpc("consume_credit", { p_user: userId, p_invoice: inv1!.id });
    expect(e1).toBeNull();

    let { data: bal } = await admin.from("credit_balances").select("*").eq("user_id", userId).single();
    expect(bal).toMatchObject({ free_credits_remaining: 0, paid_credits: 2 });

    for (let i = 0; i < 2; i++) {
      const { data: inv } = await admin
        .from("invoices")
        .insert({ user_id: userId, source_type: "xml", source_hash: `p${i}`, source_size: 1, source_data: {} })
        .select()
        .single();
      await admin.rpc("consume_credit", { p_user: userId, p_invoice: inv!.id });
    }

    ({ data: bal } = await admin.from("credit_balances").select("*").eq("user_id", userId).single());
    expect(bal).toMatchObject({ free_credits_remaining: 0, paid_credits: 0 });

    const { data: inv4 } = await admin
      .from("invoices")
      .insert({ user_id: userId, source_type: "xml", source_hash: "p3", source_size: 1, source_data: {} })
      .select()
      .single();
    const { error: outOfCredits } = await admin.rpc("consume_credit", { p_user: userId, p_invoice: inv4!.id });
    expect(outOfCredits?.message ?? "").toMatch(/insufficient_credit/);

    await admin.auth.admin.deleteUser(userId);
  });

  it("grant_paid_credits increments and logs", async () => {
    const userId = await newUser("grant");
    const { data: pur } = await admin
      .from("stripe_purchases")
      .insert({
        user_id: userId,
        stripe_checkout_session_id: `cs_${Date.now()}`,
        package_size: 10,
        unit_price_cents: 599,
        total_amount_cents: 5990,
        status: "paid"
      })
      .select()
      .single();

    await admin.rpc("grant_paid_credits", { p_user: userId, p_purchase: pur!.id, p_amount: 10 });

    const { data: bal } = await admin.from("credit_balances").select("*").eq("user_id", userId).single();
    expect(bal?.paid_credits).toBe(10);

    const { data: ledger } = await admin
      .from("credit_ledger")
      .select("event_type, delta_paid")
      .eq("user_id", userId)
      .eq("event_type", "purchase");
    expect(ledger).toEqual([{ event_type: "purchase", delta_paid: 10 }]);

    await admin.auth.admin.deleteUser(userId);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm run test:integration -- credit-functions`
Expected: FAIL — RPCs do not exist.

- [ ] **Step 3: Write migration**

```sql
create or replace function public.ensure_free_credit_for_period(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_period date := date_trunc('month', now())::date;
  v_balance        public.credit_balances%rowtype;
  v_inserted       bigint;
begin
  -- First-time creation: row arrives with the monthly free credit already granted.
  insert into public.credit_balances (user_id, free_credits_remaining, free_credits_period_start)
  values (p_user, 1, v_current_period)
  on conflict (user_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    insert into public.credit_ledger (user_id, event_type, delta_paid, delta_free, balance_paid_after, balance_free_after, note)
    values (p_user, 'free_grant', 0, 1, 0, 1, 'initial monthly free credit');
    return;
  end if;

  -- Row already existed: roll over only if a new month has started.
  select * into v_balance from public.credit_balances where user_id = p_user for update;

  if v_balance.free_credits_period_start < v_current_period then
    update public.credit_balances
       set free_credits_remaining = 1,
           free_credits_period_start = v_current_period,
           updated_at = now()
     where user_id = p_user
     returning * into v_balance;

    insert into public.credit_ledger (user_id, event_type, delta_paid, delta_free, balance_paid_after, balance_free_after, note)
    values (p_user, 'free_grant', 0, 1, v_balance.paid_credits, v_balance.free_credits_remaining, 'monthly free credit');
  end if;
end;
$$;

create or replace function public.consume_credit(p_user uuid, p_invoice uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance public.credit_balances%rowtype;
  v_delta_free int := 0;
  v_delta_paid int := 0;
begin
  perform public.ensure_free_credit_for_period(p_user);

  select * into v_balance from public.credit_balances where user_id = p_user for update;

  if v_balance.free_credits_remaining > 0 then
    v_delta_free := -1;
  elsif v_balance.paid_credits > 0 then
    v_delta_paid := -1;
  else
    raise exception 'insufficient_credit' using errcode = 'P0001';
  end if;

  update public.credit_balances
     set free_credits_remaining = free_credits_remaining + v_delta_free,
         paid_credits = paid_credits + v_delta_paid,
         updated_at = now()
   where user_id = p_user
  returning * into v_balance;

  insert into public.credit_ledger (user_id, event_type, delta_paid, delta_free, balance_paid_after, balance_free_after, invoice_id)
  values (p_user, 'consume', v_delta_paid, v_delta_free, v_balance.paid_credits, v_balance.free_credits_remaining, p_invoice);
end;
$$;

create or replace function public.grant_paid_credits(p_user uuid, p_purchase uuid, p_amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance public.credit_balances%rowtype;
begin
  if p_amount <= 0 then
    raise exception 'grant_amount_must_be_positive';
  end if;

  -- Make sure the row exists and the monthly free credit has been granted before we add paid credits.
  perform public.ensure_free_credit_for_period(p_user);

  update public.credit_balances
     set paid_credits = paid_credits + p_amount,
         updated_at = now()
   where user_id = p_user
  returning * into v_balance;

  insert into public.credit_ledger (user_id, event_type, delta_paid, delta_free, balance_paid_after, balance_free_after, stripe_purchase_id)
  values (p_user, 'purchase', p_amount, 0, v_balance.paid_credits, v_balance.free_credits_remaining, p_purchase);
end;
$$;

create or replace function public.refund_paid_credits(p_user uuid, p_purchase uuid, p_amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance public.credit_balances%rowtype;
  v_apply   int;
begin
  if p_amount <= 0 then
    raise exception 'refund_amount_must_be_positive';
  end if;

  perform public.ensure_free_credit_for_period(p_user);

  select * into v_balance from public.credit_balances where user_id = p_user for update;
  v_apply := least(p_amount, v_balance.paid_credits);

  update public.credit_balances
     set paid_credits = paid_credits - v_apply,
         updated_at = now()
   where user_id = p_user
  returning * into v_balance;

  insert into public.credit_ledger (user_id, event_type, delta_paid, delta_free, balance_paid_after, balance_free_after, stripe_purchase_id, note)
  values (
    p_user,
    'refund',
    -v_apply,
    0,
    v_balance.paid_credits,
    v_balance.free_credits_remaining,
    p_purchase,
    case when v_apply < p_amount then format('clamped: requested %s, applied %s', p_amount, v_apply) else null end
  );
end;
$$;

revoke all on function public.ensure_free_credit_for_period(uuid) from public;
revoke all on function public.consume_credit(uuid, uuid) from public;
revoke all on function public.grant_paid_credits(uuid, uuid, int) from public;
revoke all on function public.refund_paid_credits(uuid, uuid, int) from public;

grant execute on function public.ensure_free_credit_for_period(uuid) to service_role;
grant execute on function public.consume_credit(uuid, uuid) to service_role;
grant execute on function public.grant_paid_credits(uuid, uuid, int) to service_role;
grant execute on function public.refund_paid_credits(uuid, uuid, int) to service_role;
```

- [ ] **Step 4: Apply and re-run**

Run: `npm run db:reset`
Run: `npm run test:integration -- credit-functions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260513000009_credit_functions.sql tests/integration/sql/credit-functions.test.ts
git commit -m "feat(db): credit ledger SQL functions"
```

---

### Task 15: Generate database types

**Files:**
- Create: `lib/supabase/database.types.ts` (generated)

- [ ] **Step 1: Generate**

Run: `npm run db:types`
Expected: writes `lib/supabase/database.types.ts` with a `Database` interface.

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/database.types.ts
git commit -m "chore: generated supabase types"
```

---

### Task 16: Supabase browser client

**Files:**
- Create: `lib/supabase/browser.ts`

- [ ] **Step 1: Write file**

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/browser.ts
git commit -m "feat: supabase browser client"
```

---

### Task 17: Supabase server + admin clients

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`

- [ ] **Step 1: Write `server.ts`**

```ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options as CookieOptions);
            }
          } catch {
            // Called from a Server Component; the middleware will refresh.
          }
        }
      }
    }
  );
}
```

- [ ] **Step 2: Write `admin.ts`**

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let cached: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("Admin client must never be used in the browser.");
  }
  if (!cached) {
    cached = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return cached;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/server.ts lib/supabase/admin.ts
git commit -m "feat: supabase server and admin clients"
```

---

### Task 18: Session-refresh middleware

**Files:**
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Write `lib/supabase/middleware.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        }
      }
    }
  );

  await supabase.auth.getUser();

  return response;
}
```

- [ ] **Step 2: Write root `middleware.ts`**

```ts
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
```

- [ ] **Step 3: Smoke**

Run: `npm run dev`
Open `http://localhost:3000` in a browser.
Expected: landing page loads as before; no console errors; a Supabase auth cookie is set if you sign in later.

Stop the dev server (Ctrl-C).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/middleware.ts middleware.ts
git commit -m "feat: supabase session-refresh middleware"
```

---

### Task 19: requireUser helper

**Files:**
- Create: `lib/auth/require-user.ts`

- [ ] **Step 1: Write file**

```ts
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    redirect("/login");
  }
  return data.user;
}

export async function getOptionalUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/auth/require-user.ts
git commit -m "feat(auth): requireUser / getOptionalUser helpers"
```

---

### Task 20: `/login` page

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/login/login-form.tsx`

- [ ] **Step 1: Write `app/login/page.tsx`**

```tsx
import { LoginForm } from "./login-form";
import { getOptionalUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await getOptionalUser();
  if (user) redirect("/app");

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-5 py-20">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Zaloguj się do KSeF Translator</h1>
          <p className="mt-2 text-sm text-slate-600">
            Wpisz swój adres email — wyślemy Ci jednorazowy link logowania.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write `app/login/login-form.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });
    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <MailCheck className="mb-2 h-5 w-5" />
        Wysłaliśmy link logowania na <strong>{email}</strong>. Sprawdź skrzynkę.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 rounded-md border border-input bg-white px-3 outline-none focus:ring-2 focus:ring-ring"
          placeholder="ty@firma.pl"
          autoComplete="email"
        />
      </label>
      <Button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Wyślij link logowania
      </Button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}
```

- [ ] **Step 3: Manual check**

Run: `npm run dev`
Open `http://localhost:3000/login`.
Expected: form renders; submitting a fake email returns success status (Supabase local sends to Inbucket at http://localhost:54324).

- [ ] **Step 4: Commit**

```bash
git add app/login/
git commit -m "feat(auth): magic-link login page"
```

---

### Task 21: `/auth/callback` exchange

**Files:**
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Write route**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = url.searchParams.get("redirect_to") ?? "/app";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
  }

  return NextResponse.redirect(new URL(redirectTo, request.url));
}
```

- [ ] **Step 2: Commit**

```bash
git add app/auth/callback/
git commit -m "feat(auth): magic-link callback exchange"
```

---

### Task 22: signOut server action

**Files:**
- Create: `app/actions/auth.ts`

- [ ] **Step 1: Write file**

```ts
"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
```

- [ ] **Step 2: Commit**

```bash
git add app/actions/auth.ts
git commit -m "feat(auth): signOut server action"
```

---

### Task 23: Protected route group layout + `/app` placeholder

**Files:**
- Create: `app/(protected)/layout.tsx`
- Create: `app/(protected)/app/page.tsx`

- [ ] **Step 1: Write protected layout**

```tsx
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { signOut } from "@/app/actions/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 md:px-8">
          <Link href="/app" className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <FileText className="h-5 w-5 text-cyan-700" />
            KSeF Invoice Translator
          </Link>
          <nav className="flex items-center gap-3 text-sm text-slate-700">
            <Link href="/app" className="rounded-md px-3 py-2 hover:bg-slate-100">Workspace</Link>
            <Link href="/account" className="rounded-md px-3 py-2 hover:bg-slate-100">
              {user.email}
            </Link>
            <form action={signOut}>
              <button type="submit" className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                Wyloguj
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Write `/app` placeholder**

```tsx
export default function AppPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Konwerter faktur zostanie tu przeniesiony w kolejnej fazie. Na razie strona publiczna pod{" "}
        <a className="font-medium underline" href="/">/</a> pozostaje pełnoprawnym narzędziem.
      </p>
    </section>
  );
}
```

- [ ] **Step 3: Manual check**

Run: `npm run dev`. Hit `/app` while logged out → redirected to `/login`. Log in via Inbucket → redirected to `/app` with header showing your email and a working sign-out.

- [ ] **Step 4: Commit**

```bash
git add app/\(protected\)/
git commit -m "feat: protected route group with /app placeholder"
```

---

### Task 24: `/account` page

**Files:**
- Create: `app/(protected)/account/page.tsx`

- [ ] **Step 1: Write page**

```tsx
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, locale, created_at")
    .eq("id", user.id)
    .single();

  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Konto</h1>
      <dl className="mt-6 grid gap-3 text-sm">
        <div className="flex justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
          <dt className="text-slate-500">Email</dt>
          <dd className="font-medium text-slate-900">{user.email}</dd>
        </div>
        <div className="flex justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
          <dt className="text-slate-500">Język interfejsu</dt>
          <dd className="font-medium text-slate-900">{profile?.locale ?? "pl"}</dd>
        </div>
        <div className="flex justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
          <dt className="text-slate-500">Konto utworzone</dt>
          <dd className="font-medium text-slate-900">
            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pl-PL") : "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(protected\)/account/
git commit -m "feat: basic /account page"
```

---

### Task 25: Add "Zaloguj się" CTA to landing page header

**Files:**
- Modify: `app/page.tsx` (header `<nav>` block, lines ~286–303)

- [ ] **Step 1: Read current header**

Open `app/page.tsx` and locate the `<nav>` inside the `<header>` (around line 286). It currently ends with the `<select>` for `uiLanguage`.

- [ ] **Step 2: Add Sign-in link**

Add a `<Link>` to `/login` immediately after the `uiLanguage` `<select>`, inside the same `<nav>`:

```tsx
<a
  href="/login"
  className="ml-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
>
  {uiLanguage === "pl" ? "Zaloguj się" : "Sign in"}
</a>
```

- [ ] **Step 3: Manual check**

Run: `npm run dev`. Landing page renders, "Zaloguj się" / "Sign in" link appears top-right and points to `/login`.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: sign-in CTA on landing page header"
```

---

### Task 26: E2E — full magic-link signup flow

**Files:**
- Create: `tests/e2e/auth.spec.ts`

- [ ] **Step 1: Write spec**

```ts
import { test, expect } from "@playwright/test";

const INBUCKET_URL = "http://127.0.0.1:54324";

async function fetchLatestMagicLink(email: string): Promise<string> {
  const username = email.split("@")[0];
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${INBUCKET_URL}/api/v1/mailbox/${username}`);
    if (res.ok) {
      const messages = (await res.json()) as Array<{ id: string }>;
      if (messages.length > 0) {
        const latest = messages[messages.length - 1];
        const messageRes = await fetch(`${INBUCKET_URL}/api/v1/mailbox/${username}/${latest.id}`);
        const message = (await messageRes.json()) as { body: { text: string } };
        const match = message.body.text.match(/https?:\/\/[^\s]*auth\/callback[^\s]*/);
        if (match) return match[0];
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Magic link email not received in time");
}

test("sign in via magic link lands on /app", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;

  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/Wysłaliśmy link logowania/i)).toBeVisible();

  const link = await fetchLatestMagicLink(email);
  await page.goto(link);

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(email)).toBeVisible();
});

test("logged-out visit to /app redirects to /login", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
});
```

- [ ] **Step 2: Run**

Ensure `npm run db:start` is up. Then:

Run: `npm run test:e2e -- auth`
Expected: both tests PASS. If Playwright cannot reach Inbucket, confirm `supabase status` shows Inbucket on port 54324.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/auth.spec.ts
git commit -m "test(e2e): magic-link flow and /app redirect"
```

---

### Task 27: README — local dev for Supabase

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a "Local development with Supabase" section**

Add this section after the existing "Local Development" block:

```markdown
## Local development with Supabase

Phase 1 introduces Supabase auth and database. The local stack runs in Docker via the Supabase CLI.

```bash
# One-time: install Docker Desktop.
npm run db:start             # boots Postgres + Auth + Studio + Inbucket
npx supabase status          # prints URLs and keys
cp .env.test.example .env.test
cp .env.example .env.local
# Paste anon key + service_role key into both .env files.

npm run dev
```

- Studio:  http://localhost:54323
- Inbucket (catches magic-link emails): http://localhost:54324

Reset the local DB and re-apply all migrations:

```bash
npm run db:reset
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: local supabase dev instructions"
```

---

## Verification Checklist (run before marking Phase 1 done)

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (all SQL integration tests green)
- [ ] `npm run test:e2e` passes (both auth specs)
- [ ] `npm run build` succeeds
- [ ] Manual smoke: sign up with a fresh email via Inbucket, land on `/app`, sign out, hit `/app` while logged out → redirected to `/login`.
- [ ] `select * from profiles` shows the new user
- [ ] `select * from credit_balances where user_id = ...` is empty (intentional — balances are created on first credit-related action in Phase 3)
- [ ] Existing anonymous flow at `/` still works end-to-end (upload sample XML, translate, download PDF)

---

## What comes next

Phases 2–7 each get their own plan written after the previous one ships:

- **Phase 2 — Workspace behind auth:** move parse/translate/pdf flow into `/app`, persist `invoices` + `translations`, no credit enforcement yet.
- **Phase 3 — Credits & enforcement:** `consume_credit` wired into `/api/upload`, insufficient-credit modal, monthly free-credit grant.
- **Phase 4 — Stripe purchases:** pricing module, slider widget, Checkout session, webhook, `/billing`.
- **Phase 5 — History page:** `/app/history`, reopen, free re-translate, delete.
- **Phase 6 — UX polish + i18n lift:** `frontend-design` pass, balance chip, copy lift to `lib/i18n`.
- **Phase 7 — Hardening:** rate limits, Sentry, account deletion, legal pages, Stripe Tax verification.
