import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_LANGS } from "@/lib/landing/demo-sample";
import { verifyTurnstile } from "@/lib/demo/turnstile";
import { consumeUnlock, clientIpFrom } from "@/lib/demo/rate-limit";
import { sendDemoOtp } from "@/lib/demo/send-demo-otp";
import { signDownloadToken } from "@/lib/demo/download-token";

export const runtime = "nodejs";

const DEMO_LANG_CODES = DEMO_LANGS.map((l) => l.code) as [string, ...string[]];

const bodySchema = z.object({
  email: z.string().email(),
  lang: z.enum(DEMO_LANG_CODES),
  turnstileToken: z.string().min(1),
  marketingOptIn: z.boolean().optional()
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { email, lang, turnstileToken, marketingOptIn } = parsed.data;
  const ip = clientIpFrom(request);

  const turnstile = await verifyTurnstile(turnstileToken, ip);
  if (!turnstile.ok) {
    return NextResponse.json({ error: "Verification failed", code: "turnstile" }, { status: 403 });
  }

  const limit = await consumeUnlock(ip);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Daily demo limit reached", code: "rate_limited" }, { status: 429 });
  }

  // Await so the email send flushes before the serverless function can suspend,
  // but .catch so a slow or failing provider can never block or 500 the download.
  await sendDemoOtp(email, marketingOptIn ?? false).catch(() => undefined);

  const downloadToken = signDownloadToken({ lang, source: "sample" });
  return NextResponse.json({ downloadToken });
}
