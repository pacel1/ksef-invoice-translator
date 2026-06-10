import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_UNLOCK_CAP = 5;

/** Salted SHA-256 of the caller IP. The raw IP is never stored. */
export function hashIp(ip: string): string {
  const salt = process.env.DEMO_IP_SALT ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** First hop of x-forwarded-for, or a placeholder. */
export function clientIpFrom(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip")?.trim() || "0.0.0.0";
}

function unlockCap(): number {
  const raw = Number(process.env.DEMO_UNLOCK_PER_IP_PER_DAY);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_UNLOCK_CAP;
}

/**
 * Atomically increment the daily unlock counter for the IP and decide whether
 * this request is within the cap. Fails open on infra errors.
 */
export async function consumeUnlock(ip: string): Promise<{ allowed: boolean; count: number }> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("increment_demo_unlock", { p_ip_hash: hashIp(ip) });
  if (error || typeof data !== "number") {
    console.error("[demo] rate-limit counter failed, failing open", error);
    return { allowed: true, count: 0 };
  }
  return { allowed: data <= unlockCap(), count: data };
}
