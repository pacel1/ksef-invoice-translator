/**
 * Shared constants and pure helpers for the demo upload lane, importable from
 * BOTH the client (fast feedback in the dropzone) and the server (authoritative
 * checks in /api/demo/translate). Type detection mirrors detectSourceType in
 * lib/invoice/upload-service.ts, which is not exported and not client-safe.
 * Env cap overrides only take effect server-side: non-NEXT_PUBLIC vars are
 * undefined in the browser bundle, so the client sees the defaults.
 */
export type DemoUploadType = "xml" | "pdf";

export const DEMO_UPLOAD_ACCEPT = ".xml,.pdf,application/xml,text/xml,application/pdf";

const DEFAULT_MAX_XML_BYTES = 1024 * 1024; // 1 MB
const DEFAULT_MAX_PDF_BYTES = 8 * 1024 * 1024; // 8 MB

export function detectDemoUploadType(name: string, mime: string): DemoUploadType | null {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (mime === "application/xml" || mime === "text/xml" || lower.endsWith(".xml")) return "xml";
  return null;
}

function capFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function maxXmlBytes(): number {
  return capFromEnv("DEMO_MAX_XML_BYTES", DEFAULT_MAX_XML_BYTES);
}

export function maxPdfBytes(): number {
  return capFromEnv("DEMO_MAX_PDF_BYTES", DEFAULT_MAX_PDF_BYTES);
}

export function maxBytesFor(type: DemoUploadType): number {
  return type === "xml" ? maxXmlBytes() : maxPdfBytes();
}
