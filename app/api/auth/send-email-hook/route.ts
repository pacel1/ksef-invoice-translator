import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  AuthHookError,
  processAuthEmailHook,
  type ResendSendInput,
  type ResendSendResult
} from "@/lib/auth/send-email-hook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!hookSecret) {
    console.error("[api/auth/send-email-hook] SUPABASE_AUTH_HOOK_SECRET missing");
    return NextResponse.json({ error: "Hook not configured" }, { status: 500 });
  }
  if (!resendKey) {
    console.error("[api/auth/send-email-hook] RESEND_API_KEY missing");
    return NextResponse.json({ error: "Email provider not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const headers: Record<string, string | undefined> = {
    "webhook-id": request.headers.get("webhook-id") ?? undefined,
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? undefined,
    "webhook-signature": request.headers.get("webhook-signature") ?? undefined
  };

  const resend = new Resend(resendKey);
  const resendSend = async (input: ResendSendInput): Promise<ResendSendResult> => {
    const out = await resend.emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text
    });
    return out as ResendSendResult;
  };

  try {
    const { providerId } = await processAuthEmailHook({
      rawBody,
      headers,
      supabase: getSupabaseAdminClient(),
      resendSend,
      hookSecret,
      appUrl,
      fromAddress: process.env.RESEND_FROM_ADDRESS
    });
    return NextResponse.json({ ok: true, providerId });
  } catch (error) {
    if (error instanceof AuthHookError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[api/auth/send-email-hook] unexpected:", error);
    return NextResponse.json({ error: "Hook failed" }, { status: 500 });
  }
}
