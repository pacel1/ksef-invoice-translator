const SANDBOX_FROM = "KSeF Translator <onboarding@resend.dev>";

/**
 * Build a verified-domain sender address for transactional email.
 *
 * Vercel-managed hosts can never be verified as a Resend sender domain, so
 * previews and local dev fall back to Resend's sandbox sender, which only
 * delivers to the Resend account owner's email.
 */
export function resolveFromAddress(appUrl: string, localPart: string): string {
  try {
    const host = new URL(appUrl).host.replace(/^www\./, "");
    if (host.endsWith(".vercel.app") || host === "localhost" || host.startsWith("localhost:")) {
      return SANDBOX_FROM;
    }
    return `KSeF Translator <${localPart}@${host}>`;
  } catch {
    return SANDBOX_FROM;
  }
}
