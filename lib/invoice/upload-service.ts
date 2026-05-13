import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Invoice } from "@/types/invoice";
import { sha256Hex } from "@/lib/invoice/source-hash";
import { parseKsefXml } from "@/lib/xml/parser";

export interface UploadResult {
  invoice: Invoice;
  invoiceId: string;
  isNew: boolean;
  warnings: string[];
}

export interface UploadOptions {
  userId: string;
  file: File;
  supabase: SupabaseClient<Database>;
}

export class UploadError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "UploadError";
  }
}

export async function uploadInvoiceForUser({ userId, file, supabase }: UploadOptions): Promise<UploadResult> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = await sha256Hex(bytes);
  const sourceType = detectSourceType(file);

  if (sourceType === "xml") {
    return uploadXml({ userId, supabase, bytes, hash });
  }
  throw new UploadError(`Unsupported source type: ${sourceType}`, 415);
}

async function uploadXml(opts: {
  userId: string;
  supabase: SupabaseClient<Database>;
  bytes: Buffer;
  hash: string;
}): Promise<UploadResult> {
  const existing = await opts.supabase
    .from("invoices")
    .select("id, source_data, warnings")
    .eq("user_id", opts.userId)
    .eq("source_hash", opts.hash)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing.data) {
    return {
      invoice: existing.data.source_data as unknown as Invoice,
      invoiceId: existing.data.id,
      isNew: false,
      warnings: existing.data.warnings ?? []
    };
  }

  const xml = new TextDecoder().decode(opts.bytes);
  const parsed = parseKsefXml(xml);
  if (!parsed.ok) {
    throw new UploadError(parsed.error, 422);
  }

  const insert = await opts.supabase
    .from("invoices")
    .insert({
      user_id: opts.userId,
      source_type: "xml",
      source_hash: opts.hash,
      source_size: opts.bytes.length,
      invoice_number: parsed.invoice.invoiceNumber,
      issue_date: parsed.invoice.issueDate,
      currency: parsed.invoice.currency,
      total_gross: parsed.invoice.totals?.gross ?? null,
      source_data: parsed.invoice as unknown as Record<string, unknown>,
      warnings: parsed.warnings
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    throw new UploadError(insert.error?.message ?? "Failed to persist invoice", 500);
  }

  return {
    invoice: parsed.invoice,
    invoiceId: insert.data.id,
    isNew: true,
    warnings: parsed.warnings
  };
}

function detectSourceType(file: File): "xml" | "pdf" {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  return "xml";
}
