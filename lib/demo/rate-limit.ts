import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_UNLOCK_CAP = 5;
const DEFAULT_TRANSLATE_CAP = 5;
const DEFAULT_GLOBAL_TRANSLATE_CAP = 500;
const DEFAULT_PDF_CAP = 10;

function capFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/** Salted SHA-256 of the caller IP. The raw IP is never stored. */
export function hashIp(ip: string): string {
  const salt = process.env.DEMO_IP_SALT ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * First hop of x-forwarded-for, or a placeholder. Forwarded headers are
 * client-influenced, so per-IP caps are best effort; the global daily
 * breaker is the authoritative spend bound.
 */
export function clientIpFrom(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip")?.trim() || "0.0.0.0";
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
  return { allowed: data <= capFromEnv("DEMO_UNLOCK_PER_IP_PER_DAY", DEFAULT_UNLOCK_CAP), count: data };
}

export interface TranslateLimit {
  allowed: boolean;
  reason?: "ip" | "global";
  ipCount: number;
  globalCount: number;
}

/**
 * Atomically increment the per-IP and global daily translate counters and decide
 * whether this request may proceed. The global counter is the daily circuit
 * breaker bounding worst-case OpenAI spend. Fails open on infra errors.
 */
export async function consumeTranslate(ip: string): Promise<TranslateLimit> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("increment_demo_translate", { p_ip_hash: hashIp(ip) });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row || typeof row.ip_count !== "number" || typeof row.global_count !== "number") {
    console.error("[demo] translate rate-limit counter failed, failing open", error);
    return { allowed: true, ipCount: 0, globalCount: 0 };
  }
  const counts = { ipCount: row.ip_count, globalCount: row.global_count };
  if (row.ip_count > capFromEnv("DEMO_TRANSLATE_PER_IP_PER_DAY", DEFAULT_TRANSLATE_CAP)) {
    return { allowed: false, reason: "ip", ...counts };
  }
  if (row.global_count > capFromEnv("DEMO_GLOBAL_TRANSLATE_PER_DAY", DEFAULT_GLOBAL_TRANSLATE_CAP)) {
    return { allowed: false, reason: "global", ...counts };
  }
  return { allowed: true, ...counts };
}

/** Per-IP daily cap on demo PDF renders (sample and upload alike). Fails open. */
export async function consumePdf(ip: string): Promise<{ allowed: boolean; count: number }> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("increment_demo_pdf", { p_ip_hash: hashIp(ip) });
  if (error || typeof data !== "number") {
    console.error("[demo] pdf rate-limit counter failed, failing open", error);
    return { allowed: true, count: 0 };
  }
  return { allowed: data <= capFromEnv("DEMO_PDF_PER_IP_PER_DAY", DEFAULT_PDF_CAP), count: data };
}
