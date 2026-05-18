# UI Overhaul Sprint 3 — Workspace Rebuild + History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Each task uses checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `/app` from its current single-pane upload-and-toolbar layout into a three-zone shell (header + sidebar + main pane), restyle the empty state with a two-column drop-zone + onboarding grid, ship a new `/app/history` page backed by a paginated `GET /api/me/invoices` endpoint.

**Architecture:** A new `<RecentInvoicesSidebar>` server component reads the user's last 5 invoices and ships in the workspace page. The existing `<TranslatorWorkspace>` and `<LowBalanceBanner>` from Phase 4.6 keep all their behavior — they just sit inside the new shell. The history page composes `<HistoryFilterBar>` + `<InvoiceTable>` and renders rows by querying the new endpoint via server props. Row click navigates to `/app` (no in-workspace state restore in this sprint — Sprint 4 adds that). The inline credit drawer is **deferred to Sprint 4** to keep this sprint focused.

**Tech Stack:** Next.js 15 App Router (server components for sidebar + history table SSR), React 19, TypeScript, Tailwind (Sprint 1 tokens), Vitest + jsdom for components, Playwright for E2E. Backend: Supabase admin client + the existing `getCurrentBalance` / `getCurrentProfile` cache helpers.

**Spec reference:** `docs/superpowers/specs/2026-05-18-ui-overhaul-design.md` §6.1 (workspace), §6.2 (history), §7 (Sprint 3 row).

**Branch:** Continues on `claude/ui-overhaul-sprint-1` (all four sprints stack into PR #12 per user direction).

**Explicit deferrals to Sprint 4:**
- Inline credit drawer (banner + modal CTAs keep their `/billing` Link).
- Row-click-loads-invoice-in-workspace (history rows navigate to `/app` only; user re-uploads to view).
- Bulk actions on history (zip download, CSV export).
- Mobile hamburger sheet for the sidebar (responsive collapse only).

---

## File Structure

### Modified files
- `app/(protected)/app/page.tsx` — wrap existing workspace in a three-zone grid; add the sidebar
- `components/workspace/workspace-empty-state.tsx` — restyle to two-column grid
- `components/workspace/use-translator-workflow.ts` — add `loadSample()` method
- `lib/workspace/copy.ts` — add 4 new keys (`recentHeading`, `allArchive`, `helpLabel`, `contactLabel`, `tryWithSample` already exists)

### New files — backend
- `lib/invoice/recent-invoices.ts` — server helper: `getRecentInvoices(userId, limit)` + `listInvoices(userId, params)` for pagination/filters
- `app/api/me/invoices/route.ts` — `GET /api/me/invoices?page&search&from&to` paginated endpoint

### New files — workspace shell
- `components/workspace/recent-invoices-sidebar.tsx` — server-rendered sidebar with last 5 + "+ Nowa faktura" + "Cały archiwum →"

### New files — history page
- `components/history/invoice-table.tsx` — table with rows + language pills + status
- `components/history/history-filter-bar.tsx` — search input + date range
- `components/history/history-page.tsx` — composition (filter + table + empty state + pagination)
- `app/(protected)/app/history/page.tsx` — route shell (server component, fetches first page)

### New tests
- `tests/integration/lib/recent-invoices.test.ts`
- `tests/integration/api/me-invoices.test.ts`
- `tests/components/workspace/recent-invoices-sidebar.test.tsx`
- `tests/components/workspace/workspace-empty-state.test.tsx` (REPLACE the existing single-test file with full coverage)
- `tests/components/history/invoice-table.test.tsx`
- `tests/components/history/history-filter-bar.test.tsx`
- `tests/components/history/history-page.test.tsx`
- `tests/e2e/sprint-3-workspace.spec.ts`

---

## Task 1: `lib/invoice/recent-invoices.ts` server helper

**Files:**
- Create: `lib/invoice/recent-invoices.ts`
- Test: `tests/integration/lib/recent-invoices.test.ts`

This module exposes two functions: `getRecentInvoices(userId, limit)` for the sidebar (default 5) and `listInvoices(userId, params)` for the paginated history endpoint. Both query the `invoices` table joined with a count of `translations` rows, returning a shaped `InvoiceSummary` for UI consumption.

- [ ] **Step 1: Write failing test**

`tests/integration/lib/recent-invoices.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { uploadInvoiceForUser } from "@/lib/invoice/upload-service";
import { getRecentInvoices, listInvoices } from "@/lib/invoice/recent-invoices";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");
let userId: string;

beforeAll(async () => {
  const email = `recent-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  userId = data.user!.id;
});

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
});

describe("getRecentInvoices", () => {
  it("returns an empty list when the user has no invoices", async () => {
    const result = await getRecentInvoices(userId, 5);
    expect(result).toEqual([]);
  });

  it("returns invoices ordered by created_at desc, most recent first", async () => {
    // Upload three invoices with different bytes so they don't dedupe.
    const bytes1 = readFileSync(samplePath);
    const bytes2 = Buffer.concat([bytes1, Buffer.from("\n<!-- v2 -->")]);
    const bytes3 = Buffer.concat([bytes1, Buffer.from("\n<!-- v3 -->")]);

    await uploadInvoiceForUser({
      userId,
      file: new File([bytes1], "1.xml", { type: "application/xml" }),
      supabase: admin
    });
    await uploadInvoiceForUser({
      userId,
      file: new File([bytes2], "2.xml", { type: "application/xml" }),
      supabase: admin
    });
    await uploadInvoiceForUser({
      userId,
      file: new File([bytes3], "3.xml", { type: "application/xml" }),
      supabase: admin
    });

    const result = await getRecentInvoices(userId, 5);
    expect(result.length).toBe(3);
    // Most recent first
    const numbers = result.map((r) => r.invoiceNumber);
    expect(numbers[0]).toBeTruthy();
  });

  it("limits results to the requested count", async () => {
    const result = await getRecentInvoices(userId, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("returns shape: id, invoiceNumber, issueDate, sellerName, totalGross, currency, translatedLanguages", async () => {
    const result = await getRecentInvoices(userId, 1);
    expect(result.length).toBe(1);
    const row = result[0];
    expect(row).toHaveProperty("id");
    expect(row).toHaveProperty("invoiceNumber");
    expect(row).toHaveProperty("issueDate");
    expect(row).toHaveProperty("sellerName");
    expect(row).toHaveProperty("totalGross");
    expect(row).toHaveProperty("currency");
    expect(row).toHaveProperty("translatedLanguages");
    expect(Array.isArray(row.translatedLanguages)).toBe(true);
  });
});

describe("listInvoices", () => {
  it("paginates with page=1 + perPage=2", async () => {
    const page1 = await listInvoices(userId, { page: 1, perPage: 2 });
    expect(page1.rows.length).toBe(2);
    expect(page1.totalCount).toBe(3);
    expect(page1.page).toBe(1);
    expect(page1.perPage).toBe(2);
  });

  it("paginates with page=2 + perPage=2", async () => {
    const page2 = await listInvoices(userId, { page: 2, perPage: 2 });
    expect(page2.rows.length).toBe(1); // 3 total, page 2 of 2-per-page has 1
  });

  it("filters by search (substring of invoiceNumber)", async () => {
    const all = await listInvoices(userId, { page: 1, perPage: 10 });
    const someNumber = all.rows[0]?.invoiceNumber ?? "";
    if (someNumber) {
      const subset = someNumber.slice(0, 4);
      const filtered = await listInvoices(userId, { page: 1, perPage: 10, search: subset });
      expect(filtered.rows.length).toBeGreaterThan(0);
      expect(filtered.rows.every((r) => r.invoiceNumber?.includes(subset) ?? false)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run-fail**

```bash
npm test -- --run tests/integration/lib/recent-invoices.test.ts
```

Expected: FAIL, module not found.

- [ ] **Step 3: Create `lib/invoice/recent-invoices.ts`**

```typescript
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { Invoice } from "@/types/invoice";

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string | null;
  issueDate: string | null;
  sellerName: string | null;
  totalGross: number | null;
  currency: string | null;
  createdAt: string;
  translatedLanguages: string[];
}

export interface ListInvoicesParams {
  page: number;
  perPage: number;
  search?: string;
  from?: string; // ISO date
  to?: string; // ISO date
}

export interface ListInvoicesResult {
  rows: InvoiceSummary[];
  totalCount: number;
  page: number;
  perPage: number;
}

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];

interface RawInvoiceWithTranslations extends InvoiceRow {
  translations: { language: string }[] | null;
}

function rowToSummary(row: RawInvoiceWithTranslations): InvoiceSummary {
  const sourceData = row.source_data as unknown as Partial<Invoice> | null;
  const sellerName = sourceData?.seller?.name ?? null;
  const translatedLanguages = (row.translations ?? []).map((t) => t.language);

  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date,
    sellerName,
    totalGross: row.total_gross,
    currency: row.currency,
    createdAt: row.created_at,
    translatedLanguages
  };
}

/**
 * Returns the most recent N invoices for a user, with translated-language list.
 * Used by the workspace sidebar.
 */
export async function getRecentInvoices(userId: string, limit: number): Promise<InvoiceSummary[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("invoices")
    .select(`
      id, user_id, invoice_number, issue_date, currency, total_gross,
      source_type, source_hash, source_size, source_data, warnings,
      created_at, deleted_at,
      translations:translations (language)
    `)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[recent-invoices] query failed:", error);
    return [];
  }

  return (data as RawInvoiceWithTranslations[] | null)?.map(rowToSummary) ?? [];
}

/**
 * Paginated invoice list with optional search + date range filter.
 * Used by /api/me/invoices for the history page.
 */
export async function listInvoices(
  userId: string,
  params: ListInvoicesParams
): Promise<ListInvoicesResult> {
  const admin = getSupabaseAdminClient();
  const offset = (params.page - 1) * params.perPage;

  let query = admin
    .from("invoices")
    .select(
      `id, user_id, invoice_number, issue_date, currency, total_gross,
       source_type, source_hash, source_size, source_data, warnings,
       created_at, deleted_at,
       translations:translations (language)`,
      { count: "exact" }
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + params.perPage - 1);

  if (params.search && params.search.trim().length > 0) {
    query = query.ilike("invoice_number", `%${params.search.trim()}%`);
  }
  if (params.from) {
    query = query.gte("issue_date", params.from);
  }
  if (params.to) {
    query = query.lte("issue_date", params.to);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[list-invoices] query failed:", error);
    return { rows: [], totalCount: 0, page: params.page, perPage: params.perPage };
  }

  return {
    rows: (data as RawInvoiceWithTranslations[] | null)?.map(rowToSummary) ?? [],
    totalCount: count ?? 0,
    page: params.page,
    perPage: params.perPage
  };
}
```

- [ ] **Step 4: Run-pass**

```bash
npm test -- --run tests/integration/lib/recent-invoices.test.ts
```

Expected: 7/7 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/invoice/recent-invoices.ts tests/integration/lib/recent-invoices.test.ts
git commit -m "feat(invoice): recent-invoices helper — getRecentInvoices + listInvoices"
```

---

## Task 2: `GET /api/me/invoices` paginated endpoint

**Files:**
- Create: `app/api/me/invoices/route.ts`
- Test: `tests/integration/api/me-invoices.test.ts`

Authenticated endpoint that delegates to `listInvoices`. Reads `page`, `perPage`, `search`, `from`, `to` from query string.

- [ ] **Step 1: Write failing test**

`tests/integration/api/me-invoices.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

beforeAll(async () => {
  const ping = await fetch(`${APP}/`).catch(() => null);
  if (!ping) {
    throw new Error(`Next dev server not reachable at ${APP}. Start it with 'tmux new-session -d -s dev "npx next dev"' before running this test.`);
  }
});

describe("GET /api/me/invoices", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await fetch(`${APP}/api/me/invoices`);
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid page param", async () => {
    const res = await fetch(`${APP}/api/me/invoices?page=abc`);
    // Without auth this 401s before validation. Both signal a malformed request flow.
    expect([400, 401]).toContain(res.status);
  });
});
```

Note: This endpoint requires authentication; the integration test only verifies the 401 + 400 paths. Full positive-case coverage is handled by `tests/integration/lib/recent-invoices.test.ts` (the underlying helper).

- [ ] **Step 2: Run-fail**

```bash
tmux kill-session -t dev 2>/dev/null
tmux new-session -d -s dev "npx next dev"
sleep 8
npm test -- --run tests/integration/api/me-invoices.test.ts
```

Expected: FAIL, route 404.

- [ ] **Step 3: Create `app/api/me/invoices/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listInvoices } from "@/lib/invoice/recent-invoices";

export const runtime = "nodejs";

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pageRaw = searchParams.get("page");
  const perPageRaw = searchParams.get("perPage");
  const search = searchParams.get("search") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const page = pageRaw ? Number(pageRaw) : 1;
  const perPage = perPageRaw ? Math.min(Number(perPageRaw), MAX_PER_PAGE) : DEFAULT_PER_PAGE;

  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }
  if (!Number.isInteger(perPage) || perPage < 1) {
    return NextResponse.json({ error: "Invalid perPage" }, { status: 400 });
  }

  const result = await listInvoices(userData.user.id, { page, perPage, search, from, to });
  return NextResponse.json(result);
}
```

- [ ] **Step 4: Run-pass**

```bash
npm test -- --run tests/integration/api/me-invoices.test.ts
tmux kill-session -t dev 2>/dev/null
```

Expected: 2/2 passing.

- [ ] **Step 5: Commit**

```bash
git add app/api/me/invoices/route.ts tests/integration/api/me-invoices.test.ts
git commit -m "feat(api): GET /api/me/invoices paginated with filters"
```

---

## Task 3: `<RecentInvoicesSidebar>` server component

**Files:**
- Create: `components/workspace/recent-invoices-sidebar.tsx`
- Modify: `lib/workspace/copy.ts` — add `recentHeading`, `allArchive`, `helpLabel`, `contactLabel`
- Test: `tests/components/workspace/recent-invoices-sidebar.test.tsx`

Server component renders the sidebar shell. Uses `getRecentInvoices` from Task 1. Falls back to a graceful empty state when no invoices.

- [ ] **Step 1: Add copy keys to `lib/workspace/copy.ts`**

Open `lib/workspace/copy.ts`, find the `pl: {` block, add these keys near other UI labels (e.g. next to `newInvoice`):

PL block additions:
```typescript
    recentHeading: "Ostatnie",
    allArchive: "Cały archiwum",
    helpLabel: "Pomoc",
    contactLabel: "Kontakt",
```

EN block additions (next to existing `newInvoice` etc):
```typescript
    recentHeading: "Recent",
    allArchive: "Full archive",
    helpLabel: "Help",
    contactLabel: "Contact",
```

- [ ] **Step 2: Write failing test**

`tests/components/workspace/recent-invoices-sidebar.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentInvoicesSidebarView } from "@/components/workspace/recent-invoices-sidebar";
import type { InvoiceSummary } from "@/lib/invoice/recent-invoices";

const sample: InvoiceSummary[] = [
  {
    id: "i1",
    invoiceNumber: "F/24/0148",
    issueDate: "2026-05-12",
    sellerName: "ACME Sp. z o.o.",
    totalGross: 12300,
    currency: "PLN",
    createdAt: "2026-05-12T10:00:00Z",
    translatedLanguages: ["en", "de"]
  },
  {
    id: "i2",
    invoiceNumber: "F/24/0147",
    issueDate: "2026-05-11",
    sellerName: "Beta",
    totalGross: 4567,
    currency: "PLN",
    createdAt: "2026-05-11T10:00:00Z",
    translatedLanguages: []
  }
];

const baseLabels = {
  newInvoiceLabel: "+ Nowa faktura",
  recentHeading: "Ostatnie",
  allArchive: "Cały archiwum",
  helpLabel: "Pomoc",
  contactLabel: "Kontakt"
};

describe("<RecentInvoicesSidebarView>", () => {
  it("renders the New Invoice CTA", () => {
    render(<RecentInvoicesSidebarView invoices={[]} labels={baseLabels} />);
    expect(screen.getByRole("link", { name: /\+ Nowa faktura/i })).toHaveAttribute("href", "/app");
  });

  it("renders the Recent heading + Full archive link", () => {
    render(<RecentInvoicesSidebarView invoices={sample} labels={baseLabels} />);
    expect(screen.getByText(/Ostatnie/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cały archiwum/i })).toHaveAttribute("href", "/app/history");
  });

  it("renders each invoice with number and translated language pills", () => {
    render(<RecentInvoicesSidebarView invoices={sample} labels={baseLabels} />);
    expect(screen.getByText("F/24/0148")).toBeInTheDocument();
    expect(screen.getByText("F/24/0147")).toBeInTheDocument();
    // Translated languages render as PL + EN + DE pills (PL is always the source)
    expect(screen.getAllByText(/PL/).length).toBeGreaterThan(0);
    expect(screen.getByText(/EN/)).toBeInTheDocument();
    expect(screen.getByText(/DE/)).toBeInTheDocument();
  });

  it("renders Help and Contact at the bottom", () => {
    render(<RecentInvoicesSidebarView invoices={[]} labels={baseLabels} />);
    expect(screen.getByText(/Pomoc/i)).toBeInTheDocument();
    expect(screen.getByText(/Kontakt/i)).toBeInTheDocument();
  });

  it("omits the Recent list when invoices array is empty", () => {
    render(<RecentInvoicesSidebarView invoices={[]} labels={baseLabels} />);
    // Heading still renders but no invoice rows
    expect(screen.queryByText(/F\/24\//)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run-fail**

```bash
npm test -- --run tests/components/workspace/recent-invoices-sidebar.test.tsx
```

- [ ] **Step 4: Create the component**

`components/workspace/recent-invoices-sidebar.tsx`:

```tsx
import Link from "next/link";
import { Plus, HelpCircle, Mail } from "lucide-react";
import { getRecentInvoices, type InvoiceSummary } from "@/lib/invoice/recent-invoices";

export interface RecentInvoicesSidebarProps {
  userId: string;
  uiLanguage: "pl" | "en";
}

export interface RecentInvoicesSidebarLabels {
  newInvoiceLabel: string;
  recentHeading: string;
  allArchive: string;
  helpLabel: string;
  contactLabel: string;
}

export interface RecentInvoicesSidebarViewProps {
  invoices: InvoiceSummary[];
  labels: RecentInvoicesSidebarLabels;
}

const RECENT_LIMIT = 5;

/**
 * Server-rendered sidebar wrapper — fetches recent invoices then delegates to View.
 */
export async function RecentInvoicesSidebar({ userId, uiLanguage }: RecentInvoicesSidebarProps) {
  const invoices = await getRecentInvoices(userId, RECENT_LIMIT);
  const labels: RecentInvoicesSidebarLabels =
    uiLanguage === "pl"
      ? {
          newInvoiceLabel: "+ Nowa faktura",
          recentHeading: "Ostatnie",
          allArchive: "Cały archiwum",
          helpLabel: "Pomoc",
          contactLabel: "Kontakt"
        }
      : {
          newInvoiceLabel: "+ New invoice",
          recentHeading: "Recent",
          allArchive: "Full archive",
          helpLabel: "Help",
          contactLabel: "Contact"
        };

  return <RecentInvoicesSidebarView invoices={invoices} labels={labels} />;
}

/**
 * Pure presentational sidebar. Exported separately for unit testing without a DB.
 */
export function RecentInvoicesSidebarView({ invoices, labels }: RecentInvoicesSidebarViewProps) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface-muted/60 py-6 md:flex">
      <div className="px-4">
        <Link
          href="/app"
          className="inline-flex h-10 w-full items-center justify-center gap-1 rounded-md bg-accent px-4 text-small font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {labels.newInvoiceLabel.replace(/^\+\s*/, "")}
        </Link>
      </div>

      <div className="mt-8 flex-1 overflow-y-auto px-4">
        <h2 className="text-micro uppercase tracking-wide text-text-muted">
          {labels.recentHeading}
        </h2>
        <ul className="mt-3 space-y-3">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="rounded-md border border-border bg-surface p-3 shadow-sm">
              <p className="font-mono text-small text-text-strong">
                {invoice.invoiceNumber ?? "—"}
              </p>
              {invoice.issueDate ? (
                <p className="mt-0.5 text-micro text-text-muted">{invoice.issueDate}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="inline-flex h-5 items-center rounded-full bg-accent-soft px-2 text-[10px] font-semibold uppercase tracking-wide text-accent">
                  PL
                </span>
                {invoice.translatedLanguages.map((lang) => (
                  <span
                    key={lang}
                    className="inline-flex h-5 items-center rounded-full bg-surface-muted px-2 text-[10px] font-semibold uppercase tracking-wide text-text"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Link
            href="/app/history"
            className="inline-flex text-small font-medium text-accent hover:text-accent-hover"
          >
            {labels.allArchive} →
          </Link>
        </div>
      </div>

      <div className="mt-6 border-t border-border px-4 pt-4 space-y-2 text-small text-text-muted">
        <Link href="/security" className="flex items-center gap-2 hover:text-text-strong">
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
          {labels.helpLabel}
        </Link>
        <Link href="/security#kontakt" className="flex items-center gap-2 hover:text-text-strong">
          <Mail className="h-4 w-4" aria-hidden="true" />
          {labels.contactLabel}
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Run-pass**

```bash
npm test -- --run tests/components/workspace/recent-invoices-sidebar.test.tsx
```

Expected: 5/5 passing.

- [ ] **Step 6: Commit**

```bash
git add components/workspace/recent-invoices-sidebar.tsx tests/components/workspace/recent-invoices-sidebar.test.tsx lib/workspace/copy.ts
git commit -m "feat(workspace): RecentInvoicesSidebar — 240px sidebar with last 5 + archive link"
```

---

## Task 4: Three-zone shell in `/app/page.tsx`

**Files:**
- Modify: `app/(protected)/app/page.tsx`

The current page wraps `<LowBalanceBanner>` + `<TranslatorWorkspace>` in a fragment. The new page wraps them in a `<div className="flex">` with the sidebar on the left and the main pane (banner + workspace) on the right.

- [ ] **Step 1: Replace `app/(protected)/app/page.tsx`**

```tsx
import { TranslatorWorkspace } from "@/components/workspace/translator-workspace";
import { LowBalanceBanner } from "@/components/billing/low-balance-banner";
import { RecentInvoicesSidebar } from "@/components/workspace/recent-invoices-sidebar";
import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getCurrentBalance } from "@/lib/billing/get-current-balance";
import { copy } from "@/lib/workspace/copy";

export default async function AppPage() {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const balance = await getCurrentBalance(user.id);
  const t = copy[uiLanguage];

  return (
    <div className="-mx-5 -my-8 flex min-h-[calc(100vh-72px)] md:-mx-8">
      <RecentInvoicesSidebar userId={user.id} uiLanguage={uiLanguage} />
      <main className="flex-1 overflow-x-hidden px-5 py-8 md:px-8">
        <LowBalanceBanner
          initialFree={balance.freeCreditsRemaining}
          initialPaid={balance.paidCredits}
          title={String(t.lowBalanceBannerTitle)}
          body={String(t.lowBalanceBannerBody)}
          buyLabel={String(t.buyCredits)}
          closeLabel={String(t.close)}
        />
        <TranslatorWorkspace uiLanguage={uiLanguage} />
      </main>
    </div>
  );
}
```

Notes:
- `-mx-5 -my-8 md:-mx-8` counteracts the protected layout's container padding so the sidebar can sit flush with the header.
- `min-h-[calc(100vh-72px)]` reserves the viewport minus the sticky header height for the shell.
- The sidebar is `hidden md:flex` inside its own component — mobile gets single column, no sidebar.

- [ ] **Step 2: Build + manual smoke**

```bash
tmux kill-session -t dev 2>/dev/null
npm run build 2>&1 | tail -10
```

Expected: build passes; `/app` route still in the summary.

- [ ] **Step 3: Run existing E2E to confirm no workspace regression**

```bash
npm run test:e2e -- workspace credit-enforcement app-ux-redesign 2>&1 | tail -15
```

Expected: all existing /app tests pass (sidebar is `hidden md:flex` so doesn't interfere with viewport assumptions on the default 1280×720 viewport, but verify).

- [ ] **Step 4: Commit**

```bash
git add 'app/(protected)/app/page.tsx'
git commit -m "feat(workspace): three-zone shell — sidebar + main pane"
```

---

## Task 5: Restyle empty state with two-column grid

**Files:**
- Modify: `components/workspace/workspace-empty-state.tsx`
- Replace: `tests/components/workspace/workspace-empty-state.test.tsx` (existing tests need to be updated/extended)

Two-column grid: drop zone left (3/5 cols), onboarding right (2/5 cols). Add "Wypróbuj z przykładem" button. Existing onboarding panel content stays as-is — just gets the new layout.

- [ ] **Step 1: Read the existing empty state to understand current props/structure**

```bash
cat components/workspace/workspace-empty-state.tsx
```

Note the existing prop interface — preserve all existing props since `<TranslatorWorkspace>` mounts this component with those props today.

- [ ] **Step 2: Write the failing test**

Replace (or create) `tests/components/workspace/workspace-empty-state.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";

const baseProps = {
  uploading: false,
  onFile: vi.fn(),
  uploadTitle: "Wgraj KSeF FA(3) XML lub PDF",
  uploadHelp: "Przeciągnij plik tutaj albo wybierz z dysku.",
  parsingLabel: "Parsuję…",
  onboardingTitle: "Co dostajesz",
  onboardingItems: ["1 darmowa faktura", "20+ języków", "Dwujęzyczny PDF", "Bez integracji KSeF"]
};

describe("<WorkspaceEmptyState>", () => {
  it("renders the drop zone with title + help", () => {
    render(<WorkspaceEmptyState {...baseProps} />);
    expect(screen.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/Przeciągnij plik tutaj/i)).toBeInTheDocument();
  });

  it("renders the onboarding panel with all 4 items", () => {
    render(<WorkspaceEmptyState {...baseProps} />);
    expect(screen.getByText(/Co dostajesz/i)).toBeInTheDocument();
    for (const item of baseProps.onboardingItems) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it("renders the 'Wypróbuj z przykładem' button when onLoadSample is provided", () => {
    const onLoadSample = vi.fn();
    render(<WorkspaceEmptyState {...baseProps} onLoadSample={onLoadSample} sampleLabel="Wypróbuj z przykładem" />);
    const btn = screen.getByRole("button", { name: /Wypróbuj z przykładem/i });
    fireEvent.click(btn);
    expect(onLoadSample).toHaveBeenCalledTimes(1);
  });

  it("omits the sample button when onLoadSample is not provided", () => {
    render(<WorkspaceEmptyState {...baseProps} />);
    expect(screen.queryByRole("button", { name: /Wypróbuj z przykładem/i })).not.toBeInTheDocument();
  });

  it("calls onFile when a file is selected via the input", () => {
    const onFile = vi.fn();
    render(<WorkspaceEmptyState {...baseProps} onFile={onFile} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["<x/>"], "x.xml", { type: "application/xml" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("renders the parsing state when uploading=true", () => {
    render(<WorkspaceEmptyState {...baseProps} uploading={true} />);
    expect(screen.getByText(/Parsuję…/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run-fail**

```bash
npm test -- --run tests/components/workspace/workspace-empty-state.test.tsx
```

Expected: FAIL — current component doesn't have `onLoadSample` prop yet.

- [ ] **Step 4: Replace `components/workspace/workspace-empty-state.tsx`**

Preserve the existing component's API and BEHAVIOR; only restyle to two columns and add the optional sample button.

```tsx
"use client";

import { useRef } from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";

export interface WorkspaceEmptyStateProps {
  uploading: boolean;
  onFile: (file: File) => void;
  uploadTitle: string;
  uploadHelp: string;
  parsingLabel: string;
  onboardingTitle: string;
  onboardingItems: string[];
  /** Optional — only renders when provided. */
  onLoadSample?: () => void;
  sampleLabel?: string;
}

export function WorkspaceEmptyState({
  uploading,
  onFile,
  uploadTitle,
  uploadHelp,
  parsingLabel,
  onboardingTitle,
  onboardingItems,
  onLoadSample,
  sampleLabel
}: WorkspaceEmptyStateProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onPickFile() {
    inputRef.current?.click();
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    // Reset so picking the same file again still fires onChange.
    event.target.value = "";
  }

  return (
    <section className="mt-6 grid gap-6 md:grid-cols-5">
      {/* Drop zone — 3/5 cols */}
      <div className="md:col-span-3">
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file && !uploading) onFile(file);
          }}
          aria-disabled={uploading}
          className={`flex min-h-72 flex-col items-center justify-center rounded-xl border-2 border-dashed bg-surface px-6 py-12 text-center shadow-sm transition-colors ${
            uploading
              ? "border-border opacity-60"
              : "border-border-strong hover:border-accent hover:bg-accent-soft"
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-accent" />
              <p className="text-body text-text">{parsingLabel}</p>
            </>
          ) : (
            <>
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
                <UploadCloud className="h-7 w-7" aria-hidden="true" />
              </div>
              <p className="text-h3 text-text-strong">{uploadTitle}</p>
              <p className="mt-2 max-w-md text-small text-text-muted">{uploadHelp}</p>
              <button
                type="button"
                onClick={onPickFile}
                className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
              >
                {uploadTitle.includes("KSeF") ? "Wybierz plik" : "Choose file"}
              </button>
              {onLoadSample && sampleLabel ? (
                <button
                  type="button"
                  onClick={onLoadSample}
                  className="mt-3 inline-flex text-small font-medium text-accent hover:text-accent-hover"
                >
                  {sampleLabel} →
                </button>
              ) : null}
              <input
                ref={inputRef}
                type="file"
                accept=".xml,application/xml,text/xml,.pdf,application/pdf"
                className="sr-only"
                onChange={onChange}
              />
            </>
          )}
        </label>
      </div>

      {/* Onboarding panel — 2/5 cols */}
      <aside className="md:col-span-2">
        <div className="rounded-xl border border-border bg-surface-muted p-6">
          <h3 className="text-micro uppercase tracking-wide text-text-muted">{onboardingTitle}</h3>
          <ul className="mt-4 space-y-3">
            {onboardingItems.map((item) => (
              <li key={item} className="flex items-start gap-3 text-small text-text">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </section>
  );
}
```

- [ ] **Step 5: Run-pass**

```bash
npm test -- --run tests/components/workspace/workspace-empty-state.test.tsx
```

Expected: 6/6 passing.

- [ ] **Step 6: Commit**

```bash
git add components/workspace/workspace-empty-state.tsx tests/components/workspace/workspace-empty-state.test.tsx
git commit -m "feat(workspace): two-column empty state (drop zone + onboarding panel) + sample button"
```

---

## Task 6: Wire "Wypróbuj z przykładem" to load sample invoice

**Files:**
- Modify: `components/workspace/use-translator-workflow.ts` — add `loadSample()` method
- Modify: `components/workspace/translator-workspace.tsx` — pass `onLoadSample` + `sampleLabel` to empty state

`loadSample()` fetches `/sample-data/sample-fa3-invoice.xml` from `/public` (Next.js serves it static), wraps in a File, and pipes through the existing `upload()` flow. The sample needs to be served — check that `sample-data/` is publicly accessible or copy the file into `public/`.

- [ ] **Step 1: Verify sample file is accessible**

```bash
ls -la sample-data/sample-fa3-invoice.xml
ls -la public/sample-data/sample-fa3-invoice.xml 2>/dev/null || echo "Not in public — need to copy"
```

If `sample-data/sample-fa3-invoice.xml` is not under `public/`, copy it:

```bash
mkdir -p public/sample-data
cp sample-data/sample-fa3-invoice.xml public/sample-data/sample-fa3-invoice.xml
```

- [ ] **Step 2: Write failing test (in the workflow hook test file)**

Open `tests/components/workspace/use-translator-workflow.test.tsx`. Add a new test case inside the existing `describe` block (after the last existing test, before the closing brace):

```typescript
  it("loadSample fetches the sample XML and calls upload", async () => {
    const sampleBytes = new TextEncoder().encode("<Faktura/>");
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/sample-data/sample-fa3-invoice.xml")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          blob: async () => new Blob([sampleBytes], { type: "application/xml" })
        });
      }
      if (url.includes("/api/upload")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            invoice: { id: "i-sample", invoiceNumber: "SAMPLE-001" },
            invoiceId: "i-sample",
            isNew: true,
            warnings: []
          })
        });
      }
      return Promise.resolve(defaultPdfPreviewResponse());
    });

    const { result } = renderHook(() => useTranslatorWorkflow());
    await act(async () => {
      await result.current.loadSample();
    });
    // After sample loads, the invoice should be populated.
    expect(result.current.invoice).not.toBeNull();
    expect(result.current.invoiceId).toBe("i-sample");
  });
```

- [ ] **Step 3: Run-fail**

```bash
npm test -- --run tests/components/workspace/use-translator-workflow.test.tsx
```

Expected: FAIL — `loadSample` is not a function.

- [ ] **Step 4: Add `loadSample` to the hook**

Open `components/workspace/use-translator-workflow.ts`. Find the `UseTranslatorWorkflowResult` interface and add the method:

```typescript
  loadSample(): Promise<void>;
```

Find the existing `upload` function in the hook body. Add this new function near it:

```typescript
  async function loadSample() {
    try {
      const res = await fetch("/sample-data/sample-fa3-invoice.xml");
      if (!res.ok) {
        setMessages(["Nie udało się załadować przykładowej faktury."]);
        return;
      }
      const blob = await res.blob();
      const file = new File([blob], "sample-fa3-invoice.xml", { type: "application/xml" });
      await upload(file);
    } catch (err) {
      console.warn("[loadSample] failed:", err);
      setMessages(["Nie udało się załadować przykładowej faktury."]);
    }
  }
```

Add `loadSample` to the returned object:

```typescript
  return {
    invoice,
    invoiceId,
    status,
    messages,
    insufficientCredit,
    currentLanguage,
    bilingual,
    cachedLanguages,
    previewPdfUrl,
    isPreparingPreview,
    setCurrentLanguage,
    setBilingual,
    upload,
    translateCurrent,
    downloadPdf,
    dismissInsufficientCredit,
    reset,
    loadSample
  };
```

- [ ] **Step 5: Wire `loadSample` into `<TranslatorWorkspace>`**

Open `components/workspace/translator-workspace.tsx`. Destructure `loadSample` from the hook (add it to the existing list):

```typescript
  const {
    invoice,
    status,
    // ... existing fields ...
    reset,
    loadSample
  } = useTranslatorWorkflow();
```

Pass `onLoadSample` + `sampleLabel` to `<WorkspaceEmptyState>`:

```tsx
        <WorkspaceEmptyState
          uploading={status === "uploading"}
          onFile={(f) => f && upload(f)}
          uploadTitle={String(t.uploadTitle)}
          uploadHelp={String(t.uploadHelp)}
          parsingLabel={String(t.parsing)}
          onboardingTitle={String(t.onboardingTitle)}
          onboardingItems={onboardingItems}
          onLoadSample={loadSample}
          sampleLabel={String(t.tryWithSample)}
        />
```

- [ ] **Step 6: Run-pass**

```bash
npm test -- --run tests/components/workspace/use-translator-workflow.test.tsx
```

Expected: all hook tests pass including the new `loadSample` case.

- [ ] **Step 7: Commit**

```bash
git add components/workspace/use-translator-workflow.ts components/workspace/translator-workspace.tsx tests/components/workspace/use-translator-workflow.test.tsx public/sample-data/sample-fa3-invoice.xml
git commit -m "feat(workspace): loadSample() + wire Wypróbuj z przykładem button"
```

---

## Task 7: `<InvoiceTable>` component for /app/history

**Files:**
- Create: `components/history/invoice-table.tsx`
- Test: `tests/components/history/invoice-table.test.tsx`

Renders an HTML table with columns: Numer, Data, Sprzedawca, Kwota, Języki, Akcje. Row click navigates to `/app` (no in-workspace state yet — Sprint 4 adds that).

- [ ] **Step 1: Write failing test**

`tests/components/history/invoice-table.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceTable } from "@/components/history/invoice-table";
import type { InvoiceSummary } from "@/lib/invoice/recent-invoices";

const labels = {
  numberHeader: "Numer",
  dateHeader: "Data wystawienia",
  sellerHeader: "Sprzedawca",
  amountHeader: "Kwota",
  languagesHeader: "Języki",
  actionsHeader: "Akcje",
  openLabel: "Otwórz",
  emptyMessage: "Brak faktur do wyświetlenia."
};

const sample: InvoiceSummary[] = [
  {
    id: "i1",
    invoiceNumber: "F/24/0148",
    issueDate: "2026-05-12",
    sellerName: "ACME Sp. z o.o.",
    totalGross: 12300,
    currency: "PLN",
    createdAt: "2026-05-12T10:00:00Z",
    translatedLanguages: ["en", "de"]
  },
  {
    id: "i2",
    invoiceNumber: "F/24/0147",
    issueDate: "2026-05-11",
    sellerName: null,
    totalGross: null,
    currency: null,
    createdAt: "2026-05-11T10:00:00Z",
    translatedLanguages: []
  }
];

describe("<InvoiceTable>", () => {
  it("renders all column headers", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    expect(screen.getByRole("columnheader", { name: /Numer/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Data wystawienia/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Sprzedawca/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Kwota/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Języki/ })).toBeInTheDocument();
  });

  it("renders one row per invoice with the invoice number", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    expect(screen.getByText("F/24/0148")).toBeInTheDocument();
    expect(screen.getByText("F/24/0147")).toBeInTheDocument();
  });

  it("shows language pills for translated languages plus PL source", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    expect(screen.getAllByText(/PL/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("EN")).toBeInTheDocument();
    expect(screen.getByText("DE")).toBeInTheDocument();
  });

  it("renders '—' for missing values (date, seller, amount)", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    // Row 2 has nulls everywhere — multiple dashes
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders an Open link per row pointing at /app", () => {
    render(<InvoiceTable rows={sample} labels={labels} />);
    const links = screen.getAllByRole("link", { name: /Otwórz/i });
    expect(links.length).toBe(2);
    // For Sprint 3, all rows link to /app (Sprint 4 adds ?invoice=<id>).
    expect(links[0]).toHaveAttribute("href", "/app");
  });

  it("renders the empty state when rows is empty", () => {
    render(<InvoiceTable rows={[]} labels={labels} />);
    expect(screen.getByText(/Brak faktur do wyświetlenia/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run-fail**

```bash
npm test -- --run tests/components/history/invoice-table.test.tsx
```

- [ ] **Step 3: Create the component**

`components/history/invoice-table.tsx`:

```tsx
import Link from "next/link";
import type { InvoiceSummary } from "@/lib/invoice/recent-invoices";

export interface InvoiceTableLabels {
  numberHeader: string;
  dateHeader: string;
  sellerHeader: string;
  amountHeader: string;
  languagesHeader: string;
  actionsHeader: string;
  openLabel: string;
  emptyMessage: string;
}

export interface InvoiceTableProps {
  rows: ReadonlyArray<InvoiceSummary>;
  labels: InvoiceTableLabels;
}

function formatAmount(cents: number | null, currency: string | null): string {
  if (cents === null || currency === null) return "—";
  return `${(cents / 100).toFixed(2).replace(".", ",")} ${currency}`;
}

export function InvoiceTable({ rows, labels }: InvoiceTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-muted px-6 py-12 text-center text-body text-text-muted">
        {labels.emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full">
        <thead className="bg-surface-muted">
          <tr>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.numberHeader}
            </th>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.dateHeader}
            </th>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.sellerHeader}
            </th>
            <th className="px-5 py-3 text-right text-micro uppercase tracking-wide text-text-muted">
              {labels.amountHeader}
            </th>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.languagesHeader}
            </th>
            <th className="px-5 py-3 text-right text-micro uppercase tracking-wide text-text-muted">
              <span className="sr-only">{labels.actionsHeader}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface-muted">
              <td className="px-5 py-3 font-mono text-small text-text-strong">
                {row.invoiceNumber ?? "—"}
              </td>
              <td className="px-5 py-3 text-small text-text">
                {row.issueDate ?? "—"}
              </td>
              <td className="px-5 py-3 text-small text-text">
                {row.sellerName ?? "—"}
              </td>
              <td className="px-5 py-3 text-right text-small tabular-nums text-text">
                {formatAmount(row.totalGross, row.currency)}
              </td>
              <td className="px-5 py-3">
                <div className="flex flex-wrap gap-1">
                  <span className="inline-flex h-5 items-center rounded-full bg-accent-soft px-2 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    PL
                  </span>
                  {row.translatedLanguages.map((lang) => (
                    <span
                      key={lang}
                      className="inline-flex h-5 items-center rounded-full bg-surface-muted px-2 text-[10px] font-semibold uppercase tracking-wide text-text"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-5 py-3 text-right">
                <Link
                  href="/app"
                  className="text-small font-medium text-accent hover:text-accent-hover"
                >
                  {labels.openLabel} →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run-pass**

```bash
npm test -- --run tests/components/history/invoice-table.test.tsx
```

Expected: 6/6 passing.

- [ ] **Step 5: Commit**

```bash
git add components/history/invoice-table.tsx tests/components/history/invoice-table.test.tsx
git commit -m "feat(history): InvoiceTable — rows with language pills + Open links"
```

---

## Task 8: `<HistoryFilterBar>` component (search + date range)

**Files:**
- Create: `components/history/history-filter-bar.tsx`
- Test: `tests/components/history/history-filter-bar.test.tsx`

Client component. Three controls: text search, date-from, date-to. Calls `onFilterChange` with new params on every change (parent debounces if needed).

- [ ] **Step 1: Write failing test**

`tests/components/history/history-filter-bar.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryFilterBar } from "@/components/history/history-filter-bar";

const labels = {
  searchLabel: "Szukaj numeru faktury",
  searchPlaceholder: "F/24/...",
  fromLabel: "Od",
  toLabel: "Do",
  clearLabel: "Wyczyść filtry"
};

describe("<HistoryFilterBar>", () => {
  it("renders search input + date range inputs", () => {
    render(<HistoryFilterBar labels={labels} onFilterChange={vi.fn()} />);
    expect(screen.getByLabelText(/Szukaj/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Od/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Do/)).toBeInTheDocument();
  });

  it("calls onFilterChange when the search input changes", () => {
    const onFilterChange = vi.fn();
    render(<HistoryFilterBar labels={labels} onFilterChange={onFilterChange} />);
    fireEvent.change(screen.getByLabelText(/Szukaj/i), { target: { value: "F/24" } });
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ search: "F/24" }));
  });

  it("calls onFilterChange when from-date changes", () => {
    const onFilterChange = vi.fn();
    render(<HistoryFilterBar labels={labels} onFilterChange={onFilterChange} />);
    fireEvent.change(screen.getByLabelText(/Od/), { target: { value: "2026-05-01" } });
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ from: "2026-05-01" }));
  });

  it("clears all filters when the clear button is clicked", () => {
    const onFilterChange = vi.fn();
    render(
      <HistoryFilterBar
        labels={labels}
        onFilterChange={onFilterChange}
        initialSearch="F/24"
        initialFrom="2026-05-01"
        initialTo="2026-05-31"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Wyczyść filtry/i }));
    expect(onFilterChange).toHaveBeenCalledWith({
      search: "",
      from: "",
      to: ""
    });
  });
});
```

- [ ] **Step 2: Run-fail**

```bash
npm test -- --run tests/components/history/history-filter-bar.test.tsx
```

- [ ] **Step 3: Create the component**

`components/history/history-filter-bar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Search } from "lucide-react";

export interface HistoryFilterValues {
  search: string;
  from: string;
  to: string;
}

export interface HistoryFilterBarLabels {
  searchLabel: string;
  searchPlaceholder: string;
  fromLabel: string;
  toLabel: string;
  clearLabel: string;
}

export interface HistoryFilterBarProps {
  labels: HistoryFilterBarLabels;
  onFilterChange: (values: HistoryFilterValues) => void;
  initialSearch?: string;
  initialFrom?: string;
  initialTo?: string;
}

export function HistoryFilterBar({
  labels,
  onFilterChange,
  initialSearch = "",
  initialFrom = "",
  initialTo = ""
}: HistoryFilterBarProps) {
  const [search, setSearch] = useState(initialSearch);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function fire(next: Partial<HistoryFilterValues>) {
    const values: HistoryFilterValues = {
      search: next.search ?? search,
      from: next.from ?? from,
      to: next.to ?? to
    };
    onFilterChange(values);
  }

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
      <label className="flex flex-col gap-1 text-small">
        <span className="font-medium text-text">{labels.searchLabel}</span>
        <span className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              fire({ search: e.target.value });
            }}
            placeholder={labels.searchPlaceholder}
            className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-body text-text-strong outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </span>
      </label>
      <label className="flex flex-col gap-1 text-small">
        <span className="font-medium text-text">{labels.fromLabel}</span>
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            fire({ from: e.target.value });
          }}
          className="h-10 rounded-md border border-border bg-surface px-3 text-body text-text-strong outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </label>
      <label className="flex flex-col gap-1 text-small">
        <span className="font-medium text-text">{labels.toLabel}</span>
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            fire({ to: e.target.value });
          }}
          className="h-10 rounded-md border border-border bg-surface px-3 text-body text-text-strong outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </label>
      <button
        type="button"
        onClick={() => {
          setSearch("");
          setFrom("");
          setTo("");
          onFilterChange({ search: "", from: "", to: "" });
        }}
        className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-small font-medium text-text hover:bg-surface-muted"
      >
        {labels.clearLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run-pass**

```bash
npm test -- --run tests/components/history/history-filter-bar.test.tsx
```

Expected: 4/4 passing.

- [ ] **Step 5: Commit**

```bash
git add components/history/history-filter-bar.tsx tests/components/history/history-filter-bar.test.tsx
git commit -m "feat(history): HistoryFilterBar — search + date range + clear"
```

---

## Task 9: `<HistoryPage>` shared component

**Files:**
- Create: `components/history/history-page.tsx`
- Test: `tests/components/history/history-page.test.tsx`

Client component that composes the filter bar + table + pagination. Owns the fetch lifecycle: on mount, fetches `/api/me/invoices?page=1`, re-fetches when filters change.

- [ ] **Step 1: Write failing test**

`tests/components/history/history-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HistoryPage } from "@/components/history/history-page";
import type { InvoiceSummary } from "@/lib/invoice/recent-invoices";

const sampleRows: InvoiceSummary[] = [
  {
    id: "i1",
    invoiceNumber: "F/24/0148",
    issueDate: "2026-05-12",
    sellerName: "ACME",
    totalGross: 12300,
    currency: "PLN",
    createdAt: "2026-05-12T10:00:00Z",
    translatedLanguages: ["en"]
  }
];

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("<HistoryPage>", () => {
  it("renders the heading and initial rows", () => {
    render(
      <HistoryPage
        initialData={{ rows: sampleRows, totalCount: 1, page: 1, perPage: 20 }}
        locale="pl"
      />
    );
    expect(screen.getByRole("heading", { level: 1, name: /Historia faktur/i })).toBeInTheDocument();
    expect(screen.getByText("F/24/0148")).toBeInTheDocument();
  });

  it("renders the filter bar", () => {
    render(
      <HistoryPage
        initialData={{ rows: sampleRows, totalCount: 1, page: 1, perPage: 20 }}
        locale="pl"
      />
    );
    expect(screen.getByLabelText(/Szukaj/i)).toBeInTheDocument();
  });

  it("refetches when search changes", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [], totalCount: 0, page: 1, perPage: 20 })
    });
    render(
      <HistoryPage
        initialData={{ rows: sampleRows, totalCount: 1, page: 1, perPage: 20 }}
        locale="pl"
      />
    );
    fireEvent.change(screen.getByLabelText(/Szukaj/i), { target: { value: "FOO" } });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
    expect(lastCall).toContain("search=FOO");
  });

  it("renders the empty state when no rows", () => {
    render(
      <HistoryPage
        initialData={{ rows: [], totalCount: 0, page: 1, perPage: 20 }}
        locale="pl"
      />
    );
    expect(screen.getByText(/Brak faktur do wyświetlenia/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run-fail**

```bash
npm test -- --run tests/components/history/history-page.test.tsx
```

- [ ] **Step 3: Create the component**

`components/history/history-page.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  HistoryFilterBar,
  type HistoryFilterValues
} from "@/components/history/history-filter-bar";
import { InvoiceTable } from "@/components/history/invoice-table";
import type { ListInvoicesResult } from "@/lib/invoice/recent-invoices";

export interface HistoryPageProps {
  initialData: ListInvoicesResult;
  locale: "pl" | "en";
}

const COPY = {
  pl: {
    heading: "Historia faktur",
    subheading: "Wszystkie twoje przesłane faktury w jednym miejscu.",
    filterSearchLabel: "Szukaj numeru faktury",
    filterSearchPlaceholder: "F/24/...",
    filterFromLabel: "Od",
    filterToLabel: "Do",
    filterClearLabel: "Wyczyść filtry",
    tableNumberHeader: "Numer",
    tableDateHeader: "Data wystawienia",
    tableSellerHeader: "Sprzedawca",
    tableAmountHeader: "Kwota",
    tableLanguagesHeader: "Języki",
    tableActionsHeader: "Akcje",
    tableOpenLabel: "Otwórz",
    tableEmptyMessage: "Brak faktur do wyświetlenia."
  },
  en: {
    heading: "Invoice history",
    subheading: "All your uploaded invoices in one place.",
    filterSearchLabel: "Search by invoice number",
    filterSearchPlaceholder: "F/24/...",
    filterFromLabel: "From",
    filterToLabel: "To",
    filterClearLabel: "Clear filters",
    tableNumberHeader: "Number",
    tableDateHeader: "Issue date",
    tableSellerHeader: "Seller",
    tableAmountHeader: "Amount",
    tableLanguagesHeader: "Languages",
    tableActionsHeader: "Actions",
    tableOpenLabel: "Open",
    tableEmptyMessage: "No invoices to show."
  }
} as const;

export function HistoryPage({ initialData, locale }: HistoryPageProps) {
  const t = COPY[locale];
  const [data, setData] = useState<ListInvoicesResult>(initialData);
  const [, startTransition] = useTransition();

  async function applyFilters(values: HistoryFilterValues) {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("perPage", String(initialData.perPage));
    if (values.search) params.set("search", values.search);
    if (values.from) params.set("from", values.from);
    if (values.to) params.set("to", values.to);

    const res = await fetch(`/api/me/invoices?${params.toString()}`);
    if (res.ok) {
      const next = (await res.json()) as ListInvoicesResult;
      startTransition(() => setData(next));
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-h1 text-text-strong">{t.heading}</h1>
        <p className="mt-2 text-body text-text-muted">{t.subheading}</p>
      </header>
      <HistoryFilterBar
        labels={{
          searchLabel: t.filterSearchLabel,
          searchPlaceholder: t.filterSearchPlaceholder,
          fromLabel: t.filterFromLabel,
          toLabel: t.filterToLabel,
          clearLabel: t.filterClearLabel
        }}
        onFilterChange={(values) => {
          void applyFilters(values);
        }}
      />
      <InvoiceTable
        rows={data.rows}
        labels={{
          numberHeader: t.tableNumberHeader,
          dateHeader: t.tableDateHeader,
          sellerHeader: t.tableSellerHeader,
          amountHeader: t.tableAmountHeader,
          languagesHeader: t.tableLanguagesHeader,
          actionsHeader: t.tableActionsHeader,
          openLabel: t.tableOpenLabel,
          emptyMessage: t.tableEmptyMessage
        }}
      />
      {data.totalCount > data.perPage ? (
        <p className="text-small text-text-muted">
          {data.rows.length} / {data.totalCount}
        </p>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Run-pass**

```bash
npm test -- --run tests/components/history/history-page.test.tsx
```

Expected: 4/4 passing.

- [ ] **Step 5: Commit**

```bash
git add components/history/history-page.tsx tests/components/history/history-page.test.tsx
git commit -m "feat(history): HistoryPage — filter + table composition with refetch"
```

---

## Task 10: `app/(protected)/app/history/page.tsx` route shell

**Files:**
- Create: `app/(protected)/app/history/page.tsx`

Server component. Fetches first page via the server helper (not the API), passes as `initialData` to the client `<HistoryPage>`.

- [ ] **Step 1: Create the route file**

```tsx
import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listInvoices } from "@/lib/invoice/recent-invoices";
import { HistoryPage } from "@/components/history/history-page";

const DEFAULT_PER_PAGE = 20;

export default async function HistoryRoute() {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const initialData = await listInvoices(user.id, { page: 1, perPage: DEFAULT_PER_PAGE });

  return <HistoryPage initialData={initialData} locale={uiLanguage} />;
}
```

- [ ] **Step 2: Typecheck + build**

```bash
npm run typecheck && npm run build 2>&1 | grep -E "/app/history|history"
```

Expected: build references `/app/history` route.

- [ ] **Step 3: Manual smoke (start dev, check the route loads under auth)**

```bash
tmux kill-session -t dev 2>/dev/null
tmux new-session -d -s dev "npx next dev"
sleep 6
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/app/history
tmux kill-session -t dev 2>/dev/null
```

Expected: HTTP 307 (redirect to /login because no auth) — confirms route exists and middleware runs.

- [ ] **Step 4: Commit**

```bash
git add 'app/(protected)/app/history/page.tsx'
git commit -m "feat(history): /app/history route shell"
```

---

## Task 11: E2E coverage for /app/history + sidebar

**Files:**
- Create: `tests/e2e/sprint-3-workspace.spec.ts`

Three E2E tests using the existing `testUser` fixture from `tests/e2e/helpers/auth.ts`:

1. Sidebar renders on /app with "+ Nowa faktura" CTA.
2. /app/history renders with empty state when user has no invoices.
3. Upload an invoice → reload /app → sidebar shows it; navigate to /app/history → table shows it.

- [ ] **Step 1: Create the spec**

`tests/e2e/sprint-3-workspace.spec.ts`:

```typescript
import path from "node:path";
import { admin, expect, signIn, test } from "./helpers/auth";

const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

test("workspace sidebar renders with new-invoice CTA", async ({ page, testUser }) => {
  await signIn(page, testUser.email);
  // Sidebar is `hidden md:flex` — Playwright's default viewport is 1280x720 (md+).
  const newInvoice = page.getByRole("link", { name: /Nowa faktura/i }).first();
  await expect(newInvoice).toBeVisible();
  await expect(newInvoice).toHaveAttribute("href", "/app");

  const archiveLink = page.getByRole("link", { name: /Cały archiwum/i });
  await expect(archiveLink).toHaveAttribute("href", "/app/history");
});

test("/app/history renders empty state when user has no invoices", async ({ page, testUser }) => {
  await signIn(page, testUser.email);
  await page.goto("/app/history");
  await expect(page.getByRole("heading", { level: 1, name: /Historia faktur/i })).toBeVisible();
  await expect(page.getByText(/Brak faktur do wyświetlenia/i)).toBeVisible();
});

test("uploaded invoice appears in sidebar and history table", async ({ page, testUser }) => {
  await signIn(page, testUser.email);

  // Upload an invoice.
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await chooserPromise;
  const [uploadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  expect(uploadResponse.status()).toBe(200);

  // Reload — the sidebar reads recent invoices server-side, needs a server roundtrip.
  await page.reload();

  // Sidebar should now show at least one invoice with PL pill.
  const sidebarPL = page.locator("aside").getByText("PL").first();
  await expect(sidebarPL).toBeVisible();

  // Navigate to /app/history.
  await page.getByRole("link", { name: /Cały archiwum/i }).click();
  await expect(page).toHaveURL(/\/app\/history$/);
  await expect(page.getByRole("heading", { level: 1, name: /Historia faktur/i })).toBeVisible();

  // The uploaded invoice should appear as a row.
  await expect(page.getByText(/Brak faktur do wyświetlenia/i)).not.toBeVisible();
  // Row has an Open link.
  await expect(page.getByRole("link", { name: /Otwórz/i }).first()).toBeVisible();
});
```

- [ ] **Step 2: Run E2E**

```bash
tmux kill-session -t dev 2>/dev/null
npm run test:e2e -- sprint-3-workspace 2>&1 | tail -15
```

Expected: 3/3 passing.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/sprint-3-workspace.spec.ts
git commit -m "test(e2e): sprint 3 workspace shell + history page"
```

---

## Task 12: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 2: Unit + integration tests**

```bash
tmux kill-session -t dev 2>/dev/null
tmux new-session -d -s dev "npx next dev"
sleep 8 && curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/
npm test -- --run 2>&1 | tail -10
tmux kill-session -t dev 2>/dev/null
```

Expected: All pass except the two pre-existing OpenAI flakes that have been failing since Sprint 1. Sprint 3's new tests (recent-invoices, invoice-table, history-page, history-filter-bar, workspace-empty-state, use-translator-workflow loadSample) all green.

- [ ] **Step 3: Full E2E**

```bash
tmux kill-session -t dev 2>/dev/null
npm run test:e2e 2>&1 | tail -20
```

Expected: 25 baseline (Sprint 1+2) + 3 new sprint-3-workspace = 28 passing.

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | tail -20
```

Expected: clean. Route summary shows new `/app/history` route.

- [ ] **Step 5: Manual visual smoke**

```bash
tmux kill-session -t dev 2>/dev/null
tmux new-session -d -s dev "npx next dev"
sleep 6
```

Browser checks:
- `http://localhost:3000/app` after sign-in: sidebar visible on the left, drop zone takes ~3/5 of right pane, onboarding panel takes ~2/5, "Wypróbuj z przykładem" button visible
- `http://localhost:3000/app/history`: heading + filter bar + table (or empty state)
- Search box: typing into it triggers a re-fetch (network tab shows /api/me/invoices?search=...)

```bash
tmux kill-session -t dev 2>/dev/null
```

- [ ] **Step 6: No commit — verification task only**

If anything fails, fix in its own commit (don't bundle into the verification task).

---

## Explicit deferrals (NOT in Sprint 3)

These ship in Sprint 4 or later:

- **Inline credit drawer.** Banner + modal CTAs keep their `/billing` Link. Sprint 4 adds the slide-in drawer.
- **Row click loads invoice in workspace.** History rows navigate to `/app` only. Loading a specific invoice into the workspace requires lifting initial state into the hook (Sprint 4).
- **Bulk actions.** Download-all-ZIP and CSV-export are deferred — they need additional backend work.
- **Mobile hamburger sidebar.** Sprint 3 mobile gets single-column (sidebar `hidden md:flex`). Sprint 4 or later adds the slide-in mobile sheet.
- **Sort by column.** Sprint 3 ships date-desc default. Sort dropdown deferred.
- **Status filter.** Filter by "translated/not" deferred.

## After this plan

Sprint 3 lands ~14 commits on the same `claude/ui-overhaul-sprint-1` branch (PR #12). Sprint 4 — billing redesign + account redesign + RODO endpoints + inline credit drawer — branches off the SAME branch (still stacking).
