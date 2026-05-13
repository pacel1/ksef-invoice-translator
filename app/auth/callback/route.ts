import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Supabase's email-based OTP types. Validating against this allowlist prevents
// the caller from coaxing `verifyOtp` into an unintended flow via the URL.
const emailOtpTypeSchema = z.enum(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");
  const redirectTo = url.searchParams.get("redirect_to") ?? "/app";

  const supabase = await createSupabaseServerClient();

  if (code) {
    // PKCE flow: exchange the authorisation code for a session.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
    }
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  if (tokenHash && rawType) {
    const parsedType = emailOtpTypeSchema.safeParse(rawType);
    if (!parsedType.success) {
      return NextResponse.redirect(new URL("/login?error=invalid_otp_type", request.url));
    }
    // Token-hash flow: verify OTP (used by magic-link emails and email-change confirmations).
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: parsedType.data
    });
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
    }
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
}
