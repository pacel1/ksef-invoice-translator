import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { captureServer } from "@/lib/analytics/server";
import type { AnalyticsEventMap } from "@/lib/analytics/events";

// Supabase's email-based OTP types. Validating against this allowlist prevents
// the caller from coaxing `verifyOtp` into an unintended flow via the URL.
const emailOtpTypeSchema = z.enum(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

// A user whose account was created within this window is treated as a fresh
// signup (vs. a returning login). Supabase stamps `created_at` once at first
// auth, so any completion shortly after counts as the signup event.
const NEW_USER_WINDOW_MS = 5 * 60 * 1000;

// Emits the right auth-completion event from a freshly authenticated user.
// New users (created moments ago) record `signup_completed`; everyone else
// records `login_completed`. `signup_source` is seeded into user_metadata by
// the landing demo magic-link flow (lib/demo/send-demo-otp.ts).
function captureAuthCompletion(
  user: { id: string; created_at?: string; user_metadata?: Record<string, unknown> },
  method: AnalyticsEventMap["login_completed"]["method"]
): void {
  const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
  const isNew = createdAt > 0 && Date.now() - createdAt < NEW_USER_WINDOW_MS;
  if (isNew) {
    const signupSource: AnalyticsEventMap["signup_completed"]["signup_source"] =
      user.user_metadata?.source === "landing_demo" ? "landing_demo" : "direct";
    captureServer({
      distinctId: user.id,
      event: "signup_completed",
      properties: { method, signup_source: signupSource }
    });
    return;
  }
  captureServer({
    distinctId: user.id,
    event: "login_completed",
    properties: { method }
  });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");
  // Never trust redirect_to verbatim: an absolute/protocol-relative value would
  // bounce a freshly-authenticated user to an attacker host (open redirect).
  const redirectTo = safeRedirectPath(url.searchParams.get("redirect_to"));

  const supabase = await createSupabaseServerClient();

  if (code) {
    // PKCE flow: exchange the authorisation code for a session.
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
    }
    if (data.user) {
      captureAuthCompletion(data.user, "google");
    }
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  if (tokenHash && rawType) {
    const parsedType = emailOtpTypeSchema.safeParse(rawType);
    if (!parsedType.success) {
      return NextResponse.redirect(new URL("/login?error=invalid_otp_type", request.url));
    }
    // Token-hash flow: verify OTP (used by magic-link emails and email-change confirmations).
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: parsedType.data
    });
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
    }
    if (data.user) {
      captureAuthCompletion(data.user, "magic_link");
    }
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
}
