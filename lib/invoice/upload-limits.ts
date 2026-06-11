/**
 * Byte caps for the authenticated upload lane. Uploads are free (no credit is
 * consumed until translation), so without a size cap a signed-in user could
 * post very large files to exhaust serverless function memory/CPU. The cap is
 * enforced in uploadInvoiceForUser BEFORE the file is buffered into memory.
 *
 * Mirrors the demo lane's lib/demo/upload-limits.ts. Overridable via env for
 * ops tuning; non-NEXT_PUBLIC so the values never leak to the client bundle.
 */
const DEFAULT_MAX_XML_BYTES = 2 * 1024 * 1024; // 2 MB
const DEFAULT_MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

function envBytes(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function maxUploadBytes(sourceType: "xml" | "pdf"): number {
  return sourceType === "pdf"
    ? envBytes("MAX_UPLOAD_PDF_BYTES", DEFAULT_MAX_PDF_BYTES)
    : envBytes("MAX_UPLOAD_XML_BYTES", DEFAULT_MAX_XML_BYTES);
}
