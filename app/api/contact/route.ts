import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyTurnstile } from "@/lib/demo/turnstile";
import { clientIpFrom } from "@/lib/demo/rate-limit";
import { consumeContactMessage } from "@/lib/contact/rate-limit";
import { sendContactEmail } from "@/lib/contact/send-contact-email";
import { createResendSendFn } from "@/lib/email/resend-sender";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(320),
  message: z.string().trim().min(10).max(5000),
  turnstileToken: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { name, email, message, turnstileToken } = parsed.data;
  const ip = clientIpFrom(request);

  const turnstile = await verifyTurnstile(turnstileToken, ip);
  if (!turnstile.ok) {
    return NextResponse.json({ error: "Verification failed", code: "turnstile" }, { status: 403 });
  }

  const limit = await consumeContactMessage(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Daily contact limit reached", code: "rate_limited" },
      { status: 429 }
    );
  }

  const send = createResendSendFn(process.env.RESEND_API_KEY);
  if (!send) {
    // No provider configured: be honest so the UI can offer the mailto fallback.
    return NextResponse.json(
      { error: "Email delivery is not configured", code: "email_unavailable" },
      { status: 503 }
    );
  }

  const delivery = await sendContactEmail({
    name,
    email,
    message,
    send,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? ""
  });
  if (!delivery.ok) {
    return NextResponse.json(
      { error: "Failed to deliver the message", code: "send_failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
