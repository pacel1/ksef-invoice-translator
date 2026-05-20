import { NextResponse } from "next/server";
import JSZip from "jszip";
import { z } from "zod";
import { invoiceSchema } from "@/lib/invoice/schema";
import { verifyPublicKsefQrUrl } from "@/lib/ksef/public-verification";
import { renderOfficialFa3Pdf } from "@/lib/mf-fa3/official-renderer";
import { renderInvoicePdfMake } from "@/lib/pdf/invoice-pdfmake";
import { applyTranslationNoticesToPdf } from "@/lib/pdf/translation-notice-pdf";
import { supportedLanguages } from "@/lib/translation/languages";
import { getOrCreateTranslation } from "@/lib/translation/translation-cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Invoice, LanguageCode } from "@/types/invoice";

export const runtime = "nodejs";

/**
 * Batch ZIP download for the Tłumacz wizard (spec §3.5 — single zip
 * download for done items in batch mode).
 *
 * Per-invoice path mirrors /api/pdf cache flow:
 *   1. Verify ownership (IDOR check — invoice.user_id must match auth user)
 *   2. Load source invoice
 *   3. getOrCreateTranslation (cache hit if PR-#C credit-shift already paid)
 *   4. Render PDF bytes via the same official renderer + translation notices
 *
 * Then bundles everything into a JSZip-built archive and streams it.
 *
 * Auth-first ordering matches the rest of the API so test harnesses
 * can lock that property without session cookies. Cap: 20 invoices per
 * request (matches the upload-batch cap so the two batch operations
 * stay symmetric).
 */
const MAX_INVOICES_PER_ZIP = 20;

const requestSchema = z.object({
  invoiceIds: z.array(z.string().uuid()).min(1).max(MAX_INVOICES_PER_ZIP),
  language: z.string(),
  bilingual: z.boolean().optional()
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const { invoiceIds, language, bilingual = true } = parsed.data;
  if (!(language in supportedLanguages)) {
    return NextResponse.json(
      { error: "Unsupported language" },
      { status: 400 }
    );
  }
  const lang = language as LanguageCode;

  // IDOR guard: confirm every invoice belongs to the authenticated user
  // BEFORE doing expensive translation work.
  const ownership = await supabase
    .from("invoices")
    .select("id, source_data")
    .in("id", invoiceIds)
    .is("deleted_at", null);
  if (ownership.error) {
    console.error("[api/translate/zip] ownership lookup failed:", ownership.error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  const rows = ownership.data ?? [];
  if (rows.length !== invoiceIds.length) {
    // Some IDs missing or owned by someone else — RLS will have filtered.
    return NextResponse.json(
      { error: "One or more invoices not found" },
      { status: 404 }
    );
  }

  // Render every PDF in parallel — translation cache hits are fast,
  // misses defer to OpenAI but PR #C already consumed credit at translate
  // time so the work here is idempotent and free.
  const admin = getSupabaseAdminClient();
  const rendered = await Promise.allSettled(
    rows.map((row) => renderPdfForRow(row, lang, bilingual, admin))
  );

  const zip = new JSZip();
  let okCount = 0;
  for (const result of rendered) {
    if (result.status === "fulfilled") {
      zip.file(result.value.filename, result.value.bytes);
      okCount += 1;
    } else {
      console.warn("[api/translate/zip] per-invoice render failed:", result.reason);
    }
  }

  if (okCount === 0) {
    return NextResponse.json(
      { error: "Failed to render any invoices" },
      { status: 500 }
    );
  }

  const blob = await zip.generateAsync({ type: "uint8array" });
  const stamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace(/[-T:]/g, "")
    .slice(0, 12);
  return new Response(new Uint8Array(blob), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="tlumaczenia-${stamp}.zip"`,
      "X-Zip-Invoice-Count": String(okCount),
      "X-Zip-Invoice-Total": String(rows.length)
    }
  });
}

interface RenderedPdf {
  filename: string;
  bytes: Uint8Array;
}

async function renderPdfForRow(
  row: { id: string; source_data: unknown },
  language: LanguageCode,
  bilingual: boolean,
  admin: ReturnType<typeof getSupabaseAdminClient>
): Promise<RenderedPdf> {
  const sourceInvoice = invoiceSchema.parse(row.source_data);
  const translation = await getOrCreateTranslation({
    supabase: admin,
    invoice: sourceInvoice,
    invoiceId: row.id,
    language,
    bilingual
  });
  const invoice = translation.invoice;

  const verificationUrl = invoice.verification?.qrLink;
  const verificationResult = verificationUrl
    ? await verifyPublicKsefQrUrl(verificationUrl)
    : { confirmed: false as const };

  const invoiceForPdf = withConfirmedVerification(invoice, verificationResult);
  const rendered = invoice.sourceXml
    ? await renderOfficialFa3Pdf({
        sourceXml: invoice.sourceXml,
        invoice: invoiceForPdf,
        language,
        bilingual,
        translated: true
      })
    : await renderInvoicePdfMake(invoiceForPdf, language, bilingual);

  const noticed = await applyTranslationNoticesToPdf(rendered, language, {
    reviewedBy: null,
    generatedAt: formatGeneratedAt(new Date())
  });

  return {
    filename: pdfFilename(invoice.invoiceNumber),
    bytes: new Uint8Array(noticed)
  };
}

function withConfirmedVerification(
  invoice: Invoice,
  verificationResult: { confirmed: boolean; ksefNumber?: string }
): Invoice {
  if (!invoice.verification) {
    const copy = { ...invoice };
    delete copy.verification;
    return copy;
  }
  if (!verificationResult.confirmed) {
    return invoice;
  }
  return {
    ...invoice,
    verification: {
      ...invoice.verification,
      ksefNumber:
        verificationResult.ksefNumber ?? invoice.verification.ksefNumber
    }
  };
}

function pdfFilename(invoiceNumber: string | undefined | null): string {
  const safe = (invoiceNumber ?? "invoice").replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `ksef-translation-${safe}.pdf`;
}

function formatGeneratedAt(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(
      "-"
    ) +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
