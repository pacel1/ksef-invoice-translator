import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { verifyDownloadToken } from "@/lib/demo/download-token";
import { buildDemoInvoice, DEMO_LANGS, type DemoLang } from "@/lib/landing/demo-sample";
import { renderOfficialFa3Pdf } from "@/lib/mf-fa3/official-renderer";
import type { LanguageCode } from "@/types/invoice";

export const runtime = "nodejs";

const bodySchema = z.object({ downloadToken: z.string().min(1) });

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
  // Defense in depth: only render a language we actually ship, even though the
  // unlock route already enum-validates it before signing.
  const lang = verdict.payload.lang;
  if (!DEMO_LANGS.some((l) => l.code === lang)) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  let pdf: Buffer;
  try {
    pdf = await renderOfficialFa3Pdf({
      sourceXml: demoSourceXml(),
      invoice: buildDemoInvoice(lang as DemoLang),
      language: lang as LanguageCode,
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
      "Content-Disposition": `attachment; filename="tlumaczksef-demo-${lang}.pdf"`,
      "Cache-Control": "no-store"
    }
  });
}
