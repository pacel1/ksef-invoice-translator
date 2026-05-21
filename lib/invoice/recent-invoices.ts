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

export interface ListInvoicesParams {
  page: number;
  perPage: number;
  search?: string;
  from?: string;
  to?: string;
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
  const translatedLanguages = Array.from(new Set((row.translations ?? []).map((t) => t.language)));

  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date,
    sellerName,
    totalGross: row.total_gross,
    currency: row.currency,
    createdAt: row.created_at,
    translatedLanguages,
    duplicateCount: 0
  };
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

  const summaries = (data as RawInvoiceWithTranslations[] | null)?.map(rowToSummary) ?? [];
  const annotated = await annotateDuplicateCounts(admin, userId, summaries);
  return {
    rows: annotated,
    totalCount: count ?? 0,
    page: params.page,
    perPage: params.perPage
  };
}
