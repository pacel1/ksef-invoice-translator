import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { Invoice } from "@/types/invoice";
import { sha256Hex } from "@/lib/invoice/source-hash";
import { buildSyntheticFa3Xml } from "@/lib/mf-fa3/invoice-to-fa3-xml";
import { buildKsefXmlVerificationLink } from "@/lib/xml/verification";
import { parseKsefXml } from "@/lib/xml/parser";
import { maxUploadBytes } from "@/lib/invoice/upload-limits";

export interface UploadResult {
  invoice: Invoice;
  invoiceId: string;
  /**
   * Always `true` since dedupe-by-content-hash was removed. Kept on the
   * shape for backward compatibility — callers no longer condition on it.
   */
  isNew: boolean;
  warnings: string[];
  /** SHA-256 of the original source bytes — used by the upload-batch
   *  route to count OTHER rows with the same hash for this user, which
   *  drives the pre-upload "Already uploaded" warning. */
  sourceHash: string;
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
  // Detect type and enforce the byte cap BEFORE buffering the file into memory,
  // so an oversized upload is rejected without ever being read.
  const sourceType = detectSourceType(file);
  const limit = maxUploadBytes(sourceType);
  if (file.size > limit) {
    throw new UploadError(`File too large (max ${Math.floor(limit / (1024 * 1024))} MB)`, 413);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = await sha256Hex(bytes);

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

  if (insert.error || !insert.data) {
    console.error("[upload] failed to insert invoice:", insert.error);
    throw new UploadError("Failed to persist invoice", 500);
  }

  return {
    invoice,
    invoiceId: insert.data.id,
    isNew: true,
    warnings,
    sourceHash: opts.hash
  };
}

async function uploadPdf(opts: {
  userId: string;
  supabase: SupabaseClient<Database>;
  bytes: Buffer;
  hash: string;
}): Promise<UploadResult> {
  const { parseKsefPdf } = await import("@/lib/pdf/parser");
  const parsed = await parseKsefPdf(opts.bytes);
  if (!parsed.ok) {
    throw new UploadError(parsed.error, 422);
  }

  const invoice = withSyntheticPdfSourceXml(parsed.invoice);
  const warnings = [
    ...parsed.warnings,
    "PDF rendered through reconstructed FA(3) XML; original XML was not provided."
  ];

  const insert = await opts.supabase
    .from("invoices")
    .insert({
      user_id: opts.userId,
      source_type: "pdf",
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

  if (insert.error || !insert.data) {
    console.error("[upload] failed to insert invoice:", insert.error);
    throw new UploadError("Failed to persist invoice", 500);
  }

  return {
    invoice,
    invoiceId: insert.data.id,
    isNew: true,
    warnings,
    sourceHash: opts.hash
  };
}

function withSyntheticPdfSourceXml(invoice: Invoice): Invoice {
  return {
    ...invoice,
    sourceXml: buildSyntheticFa3Xml(invoice)
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
