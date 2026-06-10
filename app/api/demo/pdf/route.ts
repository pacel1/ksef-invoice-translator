import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { verifyDownloadToken } from "@/lib/demo/download-token";
import { verifyUploadToken, demoContentHash } from "@/lib/demo/upload-token";
import { consumePdf, clientIpFrom } from "@/lib/demo/rate-limit";
import { invoiceSchema } from "@/lib/invoice/schema";
import { buildDemoInvoice, DEMO_LANGS, type DemoLang } from "@/lib/landing/demo-sample";
import { renderOfficialFa3Pdf } from "@/lib/mf-fa3/official-renderer";
import type { Invoice, LanguageCode } from "@/types/invoice";

export const runtime = "nodejs";

const bodySchema = z.object({
  downloadToken: z.string().min(1),
  // Upload lane (stateless): the client re-sends exactly what /api/demo/translate
  // returned, plus the content-binding uploadToken issued there.
  invoice: z.record(z.unknown()).optional(),
  sourceXml: z.string().min(1).optional(),
  uploadToken: z.string().min(1).optional()
});

// Read the matching FA(3) source XML once per process (it never changes).
let cachedXml: string | null = null;
function demoSourceXml(): string {
  if (cachedXml === null) {
    cachedXml = readFileSync(join(process.cwd(), "public/sample-data/demo-fa3-export.xml"), "utf8");
  }
  return cachedXml;
}

export async function POST(request: Request) {
  // The token system requires this secret; without it, verification cannot run.
  if (!process.env.DEMO_TOKEN_SECRET) {
    return NextResponse.json({ error: "Demo download is not configured" }, { status: 500 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const verdict = verifyDownloadToken(parsed.data.downloadToken);
  if (!verdict.valid || !verdict.payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const limit = await consumePdf(clientIpFrom(request));
  if (!limit.allowed) {
    return NextResponse.json({ error: "Daily demo limit reached", code: "rate_limited" }, { status: 429 });
  }

  const input =
    verdict.payload.source === "upload" ? await uploadRenderInput(parsed.data) : sampleRenderInput(verdict.payload.lang);
  if ("status" in input) {
    return NextResponse.json({ error: input.error }, { status: input.status });
  }

  let pdf: Buffer;
  try {
    pdf = await renderOfficialFa3Pdf({
      sourceXml: input.sourceXml,
      invoice: input.invoice,
      language: input.lang as LanguageCode,
      bilingual: false,
      translated: true
    });
  } catch (error) {
    console.error("[demo] PDF render failed", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tlumaczksef-demo-${input.lang}.pdf"`,
      "Cache-Control": "no-store"
    }
  });
}

type RenderInput = { invoice: Invoice; sourceXml: string; lang: string };
type RenderError = { status: number; error: string };

function sampleRenderInput(lang: string): RenderInput | RenderError {
  // Defense in depth: only render a language we actually ship, even though the
  // unlock route already enum-validates it before signing.
  if (!DEMO_LANGS.some((l) => l.code === lang)) {
    return { status: 401, error: "Invalid or expired token" };
  }
  return { invoice: buildDemoInvoice(lang as DemoLang), sourceXml: demoSourceXml(), lang };
}

/**
 * Renders only content the translate pipeline produced: the uploadToken binds a
 * sha256 of the exact { invoice, sourceXml } issued by /api/demo/translate, and
 * the invoice is re-validated against invoiceSchema before rendering. The lang
 * comes from the uploadToken (the language the content was translated into).
 */
async function uploadRenderInput(body: z.infer<typeof bodySchema>): Promise<RenderInput | RenderError> {
  const { invoice, sourceXml, uploadToken } = body;
  if (!invoice || !sourceXml || !uploadToken) {
    return { status: 400, error: "Missing upload payload" };
  }
  const verdict = verifyUploadToken(uploadToken);
  if (!verdict.valid || !verdict.payload) {
    return { status: 401, error: "Invalid or expired token" };
  }
  const { hash, lang } = verdict.payload;
  if (!DEMO_LANGS.some((l) => l.code === lang)) {
    return { status: 401, error: "Invalid or expired token" };
  }
  if ((await demoContentHash(invoice, sourceXml)) !== hash) {
    return { status: 401, error: "Invalid or expired token" };
  }
  const checked = invoiceSchema.safeParse(invoice);
  if (!checked.success) {
    return { status: 400, error: "Invalid invoice" };
  }
  return { invoice: checked.data as Invoice, sourceXml, lang };
}
