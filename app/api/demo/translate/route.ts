import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_LANGS } from "@/lib/landing/demo-sample";
import { verifyTurnstile } from "@/lib/demo/turnstile";
import { consumeTranslate, clientIpFrom } from "@/lib/demo/rate-limit";
import { demoContentHash, signUploadToken } from "@/lib/demo/upload-token";
import { isDemoXmlUpload, maxXmlBytes } from "@/lib/demo/upload-limits";
import { parseKsefXml } from "@/lib/xml/parser";
import { buildKsefXmlVerificationLink } from "@/lib/xml/verification";
import { translateInvoiceFreeText } from "@/lib/translation/engine";
import type { Invoice, LanguageCode } from "@/types/invoice";

export const runtime = "nodejs";

const DEMO_LANG_CODES = DEMO_LANGS.map((l) => l.code) as [string, ...string[]];

const fieldsSchema = z.object({
  lang: z.enum(DEMO_LANG_CODES),
  turnstileToken: z.string().min(1)
});

/**
 * Stateless Lane 2 endpoint: nothing the visitor uploads is ever persisted.
 * Guard order is locked by the design spec (section 12):
 * Turnstile -> per-IP cap + global breaker -> MIME/extension + size -> parse -> translate.
 */
export async function POST(request: Request) {
  if (!process.env.DEMO_TOKEN_SECRET) {
    return NextResponse.json({ error: "Demo upload is not configured" }, { status: 500 });
  }

  // Bound memory before request.formData() buffers the whole body. Multipart
  // overhead gets 1 MiB of slack; the deploy platform additionally enforces its
  // own request-body cap upstream of this handler.
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxXmlBytes() + 1024 * 1024) {
    return NextResponse.json({ error: "File too large", code: "too_large" }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const parsed = fieldsSchema.safeParse({
    lang: form?.get("lang"),
    turnstileToken: form?.get("turnstileToken")
  });
  if (!parsed.success || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { lang, turnstileToken } = parsed.data;
  const ip = clientIpFrom(request);

  const turnstile = await verifyTurnstile(turnstileToken, ip);
  if (!turnstile.ok) {
    return NextResponse.json({ error: "Verification failed", code: "turnstile" }, { status: 403 });
  }

  const limit = await consumeTranslate(ip);
  if (!limit.allowed) {
    if (limit.reason === "global") {
      return NextResponse.json({ error: "Demo is over capacity today", code: "circuit_breaker" }, { status: 503 });
    }
    return NextResponse.json({ error: "Daily demo limit reached", code: "rate_limited" }, { status: 429 });
  }

  if (!isDemoXmlUpload(file.name, file.type)) {
    return NextResponse.json({ error: "Unsupported file type", code: "unsupported" }, { status: 415 });
  }
  if (file.size > maxXmlBytes()) {
    return NextResponse.json({ error: "File too large", code: "too_large" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sourced = await parseXmlUpload(bytes);
  if (!sourced.ok) {
    console.warn("[demo] upload parse failed", sourced.error);
    return NextResponse.json({ error: "Could not read this invoice", code: "parse_failed" }, { status: 422 });
  }

  let invoice;
  try {
    invoice = await translateInvoiceFreeText(sourced.invoice, lang as LanguageCode);
  } catch (error) {
    console.error("[demo] translate failed", error);
    return NextResponse.json({ error: "Translation failed", code: "translate_failed" }, { status: 502 });
  }

  // Bind the exact response payload into a signed token so /api/demo/pdf can
  // verify it renders only what this pipeline produced (see the plan's
  // security decision). The hash recipe (JSON.stringify(invoice) + "\0" +
  // sourceXml) is a contract shared with /api/demo/pdf via demoContentHash;
  // both sides must hash the identical byte recipe. Nothing is persisted.
  const uploadToken = signUploadToken({ hash: await demoContentHash(invoice, sourced.sourceXml), lang });
  return NextResponse.json({ invoice, sourceXml: sourced.sourceXml, uploadToken });
}

type ParsedUpload = { ok: true; invoice: Invoice; sourceXml: string } | { ok: false; error: string };

async function parseXmlUpload(bytes: Buffer): Promise<ParsedUpload> {
  const xml = new TextDecoder().decode(bytes);
  const parsed = parseKsefXml(xml);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  // Same QR-link fidelity as the authenticated upload path (pure, no network).
  const qrLink = await buildKsefXmlVerificationLink(
    new Uint8Array(bytes).buffer,
    parsed.invoice.issueDate,
    parsed.invoice.seller.vatId
  );
  const invoice = qrLink
    ? { ...parsed.invoice, verification: { ...parsed.invoice.verification, qrLink } }
    : parsed.invoice;
  return { ok: true, invoice, sourceXml: xml };
}
