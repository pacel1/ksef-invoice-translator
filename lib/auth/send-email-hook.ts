import type { SupabaseClient } from "@supabase/supabase-js";
import { Webhook } from "standardwebhooks";
import type { Database } from "@/lib/supabase/database.types";
import { renderAuthEmail } from "@/emails/render-template";

export class AuthHookError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "AuthHookError";
  }
}

export interface ResendSendInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface ResendSendResult {
  data?: { id?: string } | null;
  error?: { message?: string } | null;
}

export type ResendSendFn = (input: ResendSendInput) => Promise<ResendSendResult>;

export interface ProcessAuthEmailHookOptions {
  rawBody: string;
  headers: Record<string, string | undefined>;
  supabase: SupabaseClient<Database>;
  resendSend: ResendSendFn;
  hookSecret: string;
  appUrl: string;
  /** Sender address — defaults to `auth@<APP_HOST>`. Override per env if needed. */
  fromAddress?: string;
}

interface SupabaseEmailHookPayload {
  user: { id?: string; email: string };
  email_data: {
    token?: string;
    token_hash: string;
    redirect_to?: string;
    email_action_type: string;
    site_url?: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

export async function processAuthEmailHook(
  opts: ProcessAuthEmailHookOptions
): Promise<{ providerId: string | null }> {
  const sigHeaders = {
    "webhook-id": opts.headers["webhook-id"] ?? "",
    "webhook-timestamp": opts.headers["webhook-timestamp"] ?? "",
    "webhook-signature": opts.headers["webhook-signature"] ?? ""
  };

  if (!sigHeaders["webhook-id"] || !sigHeaders["webhook-signature"]) {
    throw new AuthHookError("Missing webhook signature headers", 401);
  }

  let payload: SupabaseEmailHookPayload;
  try {
    const normalizedSecret = opts.hookSecret.startsWith("v1,")
      ? opts.hookSecret.slice(3)
      : opts.hookSecret;
    const wh = new Webhook(normalizedSecret);
    payload = wh.verify(opts.rawBody, sigHeaders) as SupabaseEmailHookPayload;
  } catch (error) {
    throw new AuthHookError(
      `Invalid webhook signature: ${error instanceof Error ? error.message : "verify failed"}`,
      401
    );
  }

  const email = payload.user?.email;
  const tokenHash = payload.email_data?.token_hash;
  const actionType = payload.email_data?.email_action_type ?? "magiclink";
  const redirectTo = payload.email_data?.redirect_to ?? "/app";

  if (!email || !tokenHash) {
    throw new AuthHookError("Payload missing email or token_hash", 400);
  }

  // Look up locale (best-effort; default to en).
  let locale: "pl" | "en" = "en";
  if (payload.user.id) {
    const { data: profile } = await opts.supabase
      .from("profiles")
      .select("locale")
      .eq("id", payload.user.id)
      .maybeSingle();
    if (profile?.locale === "pl") locale = "pl";
  }

  const callbackPath = `/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(
    actionType === "magiclink" ? "email" : actionType
  )}&redirect_to=${encodeURIComponent(redirectTo)}`;
  const link = `${opts.appUrl}${callbackPath}`;

  const { subject, html, plainText } = await renderAuthEmail({
    link,
    locale,
    recipientEmail: email,
    actionType
  });

  const fromAddress = opts.fromAddress ?? defaultFromAddress(opts.appUrl);

  const result = await opts.resendSend({
    from: fromAddress,
    to: email,
    subject,
    html,
    text: plainText
  });

  if (result.error) {
    console.error("[auth-email-hook] resend send failed:", result.error);
    throw new AuthHookError(`Email send failed: ${result.error.message ?? "unknown"}`, 502);
  }

  return { providerId: result.data?.id ?? null };
}

function defaultFromAddress(appUrl: string): string {
  try {
    const host = new URL(appUrl).host.replace(/^www\./, "");
    return `KSeF Translator <auth@${host}>`;
  } catch {
    return "KSeF Translator <onboarding@resend.dev>";
  }
}
