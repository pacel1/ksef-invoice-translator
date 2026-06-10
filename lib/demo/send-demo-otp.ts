import { createClient } from "@supabase/supabase-js";

/**
 * Fires a passwordless magic-link signup for the demo gate. Uses a fresh anon
 * client with no session persistence (this is not logging the visitor in here;
 * the account activates when they click the emailed link). Never throws: the
 * PDF download must proceed even if Supabase rate-limits the email.
 */
export async function sendDemoOtp(email: string, marketingOptIn: boolean): Promise<void> {
  try {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: { source: "landing_demo", marketing_opt_in: marketingOptIn }
      }
    });
    if (error) console.warn("[demo] OTP send returned an error (ignored)", error.status, error.message);
  } catch (error) {
    console.warn("[demo] OTP send threw (ignored)", error);
  }
}
