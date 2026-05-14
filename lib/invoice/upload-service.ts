import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { Invoice } from "@/types/invoice";
import { sha256Hex } from "@/lib/invoice/source-hash";
import { buildKsefXmlVerificationLink } from "@/lib/xml/verification";
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
  return uploadPdf({ userId, supabase, bytes, hash });
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

  if (existing.error) {
    console.error("[upload] dedupe lookup failed:", existing.error);
    throw new UploadError("Failed to check for existing invoice", 500);
  }

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
  const sourceBytes = new Uint8Array(opts.bytes).buffer;
  const qrLink = await buildKsefXmlVerificationLink(
    sourceBytes,
    parsed.invoice.issueDate,
    parsed.invoice.seller.vatId
  );
  const invoice: Invoice = {
    ...parsed.invoice,
    sourceXml: xml,
    verification: qrLink
      ? {
          ...parsed.invoice.verification,
          qrLink
        }
      : parsed.invoice.verification
  };
  const warnings = qrLink
    ? parsed.warnings
    : [...parsed.warnings, "Unable to build KSeF XML verification link: missing seller NIP or issue date."];

  const insert = await opts.supabase
    .from("invoices")
    .insert({
      user_id: opts.userId,
      source_type: "xml",
      source_hash: opts.hash,
      source_size: opts.bytes.length,
      invoice_number: invoice.invoiceNumber,
      issue_date: invoice.issueDate,
      currency: invoice.currency,
      total_gross: invoice.totals?.gross ?? null,
      source_data: invoice as unknown as Json,
      warnings
    })
    .select("id")
    .single();

  if (insert.error) {
    if (insert.error.code === "23505") {
      const winner = await opts.supabase
        .from("invoices")
        .select("id, source_data, warnings")
        .eq("user_id", opts.userId)
        .eq("source_hash", opts.hash)
        .is("deleted_at", null)
        .maybeSingle();
      if (winner.data) {
        return {
          invoice: winner.data.source_data as unknown as Invoice,
          invoiceId: winner.data.id,
          isNew: false,
          warnings: winner.data.warnings ?? []
        };
      }
    }
    console.error("[upload] failed to insert invoice:", insert.error);
    throw new UploadError("Failed to persist invoice", 500);
  }

  if (!insert.data) {
    throw new UploadError("Failed to persist invoice", 500);
  }

  return {
    invoice,
    invoiceId: insert.data.id,
    isNew: true,
    warnings
  };
}

async function uploadPdf(opts: {
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

  if (existing.error) {
    console.error("[upload] dedupe lookup failed:", existing.error);
    throw new UploadError("Failed to check for existing invoice", 500);
  }

  if (existing.data) {
    return {
      invoice: existing.data.source_data as unknown as Invoice,
      invoiceId: existing.data.id,
      isNew: false,
      warnings: existing.data.warnings ?? []
    };
  }

  const { parseKsefPdf } = await import("@/lib/pdf/parser");
  const parsed = await parseKsefPdf(opts.bytes);
  if (!parsed.ok) {
    throw new UploadError(parsed.error, 422);
  }

  const insert = await opts.supabase
    .from("invoices")
    .insert({
      user_id: opts.userId,
      source_type: "pdf",
      source_hash: opts.hash,
      source_size: opts.bytes.length,
      invoice_number: parsed.invoice.invoiceNumber,
      issue_date: parsed.invoice.issueDate,
      currency: parsed.invoice.currency,
      total_gross: parsed.invoice.totals?.gross ?? null,
      source_data: parsed.invoice as unknown as Json,
      warnings: parsed.warnings
    })
    .select("id")
    .single();

  if (insert.error) {
    if (insert.error.code === "23505") {
      const winner = await opts.supabase
        .from("invoices")
        .select("id, source_data, warnings")
        .eq("user_id", opts.userId)
        .eq("source_hash", opts.hash)
        .is("deleted_at", null)
        .maybeSingle();
      if (winner.data) {
        return {
          invoice: winner.data.source_data as unknown as Invoice,
          invoiceId: winner.data.id,
          isNew: false,
          warnings: winner.data.warnings ?? []
        };
      }
    }
    console.error("[upload] failed to insert invoice:", insert.error);
    throw new UploadError("Failed to persist invoice", 500);
  }

  if (!insert.data) {
    throw new UploadError("Failed to persist invoice", 500);
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
  if (
    file.type === "application/xml" ||
    file.type === "text/xml" ||
    name.endsWith(".xml")
  ) {
    return "xml";
  }
  throw new UploadError(`Unsupported file type: ${file.type || file.name}`, 415);
}
