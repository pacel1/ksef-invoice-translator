import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { Invoice } from "@/types/invoice";

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string | null;
  issueDate: string | null;
  sellerName: string | null;
  buyerName: string | null;
  totalGross: number | null;
  currency: string | null;
  createdAt: string;
  translatedLanguages: string[];
  /**
   * Count of OTHER invoices the user has with the same invoice_number
   * (excluding this row). > 0 means there are duplicate uploads for the
   * same human-readable number — the history UI surfaces it as a badge
   * so the user can spot accidental re-uploads or version drift.
   *
   * Always 0 when invoiceNumber is null.
   */
  duplicateCount: number;
}

export type InvoiceSortBy =
  | "createdAt"
  | "invoiceNumber"
  | "buyerName"
  | "status";

export type SortOrder = "asc" | "desc";

export interface ListInvoicesParams {
  page: number;
  perPage: number;
  search?: string;
  from?: string;
  to?: string;
  sortBy?: InvoiceSortBy;
  sortOrder?: SortOrder;
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
  const buyerName = sourceData?.buyer?.name ?? null;
  const translatedLanguages = Array.from(new Set((row.translations ?? []).map((t) => t.language)));

  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date,
    sellerName,
    buyerName,
    totalGross: row.total_gross,
    currency: row.currency,
    createdAt: row.created_at,
    translatedLanguages,
    duplicateCount: 0
  };
}

/**
 * Maps the public `sortBy` enum to the actual Supabase column expression.
 * Returning `null` means "sort client-side" (used for status, which would
 * need a join-count subquery to do server-side).
 */
function sortColumnFor(sortBy: InvoiceSortBy): string | null {
  switch (sortBy) {
    case "createdAt":
      return "created_at";
    case "invoiceNumber":
      return "invoice_number";
    case "buyerName":
      // Supabase JS supports JSONB path ordering via the `->>` text accessor.
      return "source_data->buyer->>name";
    case "status":
      return null;
    default: {
      const _exhaustive: never = sortBy;
      void _exhaustive;
      return null;
    }
  }
}

/**
 * Mutates each summary in place to set `duplicateCount` based on how many
 * other rows the user has with the same invoice_number. Single SQL trip
 * scoped to the numbers present in `summaries` — O(N) over the result
 * set, not O(N) round trips.
 */
async function annotateDuplicateCounts(
  client: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
  summaries: InvoiceSummary[]
): Promise<InvoiceSummary[]> {
  const numbers = Array.from(
    new Set(
      summaries
        .map((s) => s.invoiceNumber)
        .filter((n): n is string => typeof n === "string" && n.length > 0)
    )
  );
  if (numbers.length === 0) return summaries;

  const { data, error } = await client
    .from("invoices")
    .select("invoice_number")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("invoice_number", numbers);

  if (error) {
    console.error("[recent-invoices] duplicate-count lookup failed:", error);
    return summaries;
  }

  const totals = new Map<string, number>();
  for (const row of data ?? []) {
    const n = row.invoice_number;
    if (typeof n === "string") totals.set(n, (totals.get(n) ?? 0) + 1);
  }

  return summaries.map((s) => {
    if (!s.invoiceNumber) return s;
    const total = totals.get(s.invoiceNumber) ?? 1;
    return { ...s, duplicateCount: Math.max(total - 1, 0) };
  });
}

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

  const summaries = (data as RawInvoiceWithTranslations[] | null)?.map(rowToSummary) ?? [];
  return annotateDuplicateCounts(admin, userId, summaries);
}

export async function listInvoices(
  userId: string,
  params: ListInvoicesParams
): Promise<ListInvoicesResult> {
  const admin = getSupabaseAdminClient();
  const sortBy: InvoiceSortBy = params.sortBy ?? "createdAt";
  const ascending = (params.sortOrder ?? "desc") === "asc";
  const sortColumn = sortColumnFor(sortBy);

  // Status sort can't be expressed via a single .order() — translations is
  // a 1-to-many nested resource, and PostgREST doesn't surface a count
  // expression we can ORDER BY. Fall back to fetching the candidate set,
  // sorting in JS by translation count, then slicing to the page. This
  // costs a wider fetch but stays correct across pages.
  if (sortBy === "status" || sortColumn === null) {
    return listInvoicesWithStatusSort(admin, userId, params, ascending);
  }

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
    .order(sortColumn, { ascending, nullsFirst: false })
    .range(offset, offset + params.perPage - 1);

  // Stable tiebreaker so paginated results never duplicate rows when the
  // primary sort column has ties (e.g. two invoices issued same minute).
  if (sortColumn !== "created_at") {
    query = query.order("created_at", { ascending: false });
  }

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

  const summaries = (data as RawInvoiceWithTranslations[] | null)?.map(rowToSummary) ?? [];
  const annotated = await annotateDuplicateCounts(admin, userId, summaries);
  return {
    rows: annotated,
    totalCount: count ?? 0,
    page: params.page,
    perPage: params.perPage
  };
}

async function listInvoicesWithStatusSort(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
  params: ListInvoicesParams,
  ascending: boolean
): Promise<ListInvoicesResult> {
  // Fetch the full filtered set (no .range) so we can sort by translation
  // count across the whole archive. For typical per-user history sizes
  // (<1k rows) this is cheap; if it grows large the right answer is a
  // denormalised translation_count column.
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
    .is("deleted_at", null);

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
    console.error("[list-invoices] status-sort query failed:", error);
    return { rows: [], totalCount: 0, page: params.page, perPage: params.perPage };
  }

  const summaries = (data as RawInvoiceWithTranslations[] | null)?.map(rowToSummary) ?? [];
  const sorted = [...summaries].sort((a, b) => {
    const aCount = a.translatedLanguages.length;
    const bCount = b.translatedLanguages.length;
    if (aCount !== bCount) return ascending ? aCount - bCount : bCount - aCount;
    // Stable tiebreaker: newest first regardless of primary direction.
    return a.createdAt < b.createdAt ? 1 : -1;
  });

  const offset = (params.page - 1) * params.perPage;
  const pageSlice = sorted.slice(offset, offset + params.perPage);
  const annotated = await annotateDuplicateCounts(admin, userId, pageSlice);
  return {
    rows: annotated,
    totalCount: count ?? 0,
    page: params.page,
    perPage: params.perPage
  };
}
