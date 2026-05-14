import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const ABUSE_CAP_SESSIONS_24H = 3;
export const ABUSE_CAP_CREDITS_24H = 500;

export type AbuseCapReason = "session_cap" | "credit_cap";

export class AbuseCapError extends Error {
  constructor(public readonly reason: AbuseCapReason) {
    super(`abuse_cap_${reason}`);
    this.name = "AbuseCapError";
  }
}

export interface AbuseCapsOptions {
  supabase: SupabaseClient<Database>;
  userId: string;
  /** If provided, factored into the credit cap check. */
  requestedPackageSize?: number;
}

export async function assertWithinAbuseCaps({
  supabase,
  userId,
  requestedPackageSize = 0
}: AbuseCapsOptions): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("stripe_purchases")
    .select("package_size")
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) {
    console.error("[abuse-caps] lookup failed:", error);
    throw new Error("Failed to verify purchase rate limits");
  }

  const recentSessions = data?.length ?? 0;
  if (recentSessions >= ABUSE_CAP_SESSIONS_24H) {
    throw new AbuseCapError("session_cap");
  }

  const recentCredits = (data ?? []).reduce((sum, row) => sum + row.package_size, 0);
  if (recentCredits + requestedPackageSize > ABUSE_CAP_CREDITS_24H) {
    throw new AbuseCapError("credit_cap");
  }
}
