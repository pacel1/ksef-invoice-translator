import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashIp } from "@/lib/demo/rate-limit";

const DEFAULT_CONTACT_CAP = 5;
const DEFAULT_GLOBAL_CONTACT_CAP = 100;

function capFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export interface ContactLimit {
  allowed: boolean;
  reason?: "ip" | "global";
  ipCount: number;
  globalCount: number;
}

/**
 * Atomically increment the per-IP and global daily contact-message counters and
 * decide whether this request may proceed. Forwarded-for headers are
 * client-influenced, so the per-IP cap is best effort; the global counter is
 * the daily circuit breaker bounding worst-case email spend. Fails open on
 * infra errors so a counter outage can never block a legitimate message.
 */
export async function consumeContactMessage(ip: string): Promise<ContactLimit> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("increment_contact_message", { p_ip_hash: hashIp(ip) });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row || typeof row.ip_count !== "number" || typeof row.global_count !== "number") {
    console.error("[contact] rate-limit counter failed, failing open", error);
    return { allowed: true, ipCount: 0, globalCount: 0 };
  }
  const counts = { ipCount: row.ip_count, globalCount: row.global_count };
  if (row.ip_count > capFromEnv("CONTACT_MESSAGES_PER_IP_PER_DAY", DEFAULT_CONTACT_CAP)) {
    return { allowed: false, reason: "ip", ...counts };
  }
  if (row.global_count > capFromEnv("CONTACT_MESSAGES_GLOBAL_PER_DAY", DEFAULT_GLOBAL_CONTACT_CAP)) {
    return { allowed: false, reason: "global", ...counts };
  }
  return { allowed: true, ...counts };
}
