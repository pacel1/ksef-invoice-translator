/**
 * Shared constants and pure helpers for the demo upload lane (XML only),
 * importable from BOTH the client (fast feedback in the dropzone) and the
 * server (authoritative checks in /api/demo/translate). Detection mirrors the
 * XML branch of detectSourceType in lib/invoice/upload-service.ts, which is
 * not exported and not client-safe. The env cap override only takes effect
 * server-side: non-NEXT_PUBLIC vars are undefined in the browser bundle, so
 * the client sees the default.
 */
export const DEMO_UPLOAD_ACCEPT = ".xml,application/xml,text/xml";

const DEFAULT_MAX_XML_BYTES = 1024 * 1024; // 1 MB

/** The demo translates KSeF XML only; PDFs and anything else are rejected. */
export function isDemoXmlUpload(name: string, mime: string): boolean {
  return mime === "application/xml" || mime === "text/xml" || name.toLowerCase().endsWith(".xml");
}

export function maxXmlBytes(): number {
  const raw = Number(process.env.DEMO_MAX_XML_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_XML_BYTES;
}
