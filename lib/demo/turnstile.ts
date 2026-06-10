const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verifies a Cloudflare Turnstile token server-side. In non-production with no
 * secret configured it passes (local/preview convenience); in production with no
 * secret it fails closed.
 */
export async function verifyTurnstile(token: string, ip?: string): Promise<{ ok: boolean }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: process.env.NODE_ENV !== "production" };
  }
  if (!token) return { ok: false };

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const data = (await res.json()) as { success?: boolean };
    return { ok: data.success === true };
  } catch (error) {
    console.error("[demo] turnstile verify failed", error);
    return { ok: false };
  }
}
