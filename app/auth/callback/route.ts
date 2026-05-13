import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
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

  if (tokenHash && type) {
    // Token-hash flow: verify OTP (used by magic-link emails and email-change confirmations).
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"]
    });
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
    }
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
}
