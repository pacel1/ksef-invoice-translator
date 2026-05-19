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
    translatedLanguages
  };
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

  return (data as RawInvoiceWithTranslations[] | null)?.map(rowToSummary) ?? [];
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

  return {
    rows: (data as RawInvoiceWithTranslations[] | null)?.map(rowToSummary) ?? [],
    totalCount: count ?? 0,
    page: params.page,
    perPage: params.perPage
  };
}
