import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const ABUSE_CAP_SESSIONS_24H = 3;
export const ABUSE_CAP_CREDITS_24H = 500;
export const ABUSE_CAP_PENDING_SESSIONS_1H = 5;

// Statuses that represent a completed purchase. Refunded still counts —
// refund churn must not reset the cap. Pending/failed/expired sessions
// never took money; pending only feeds the short-window spam cap below.
const COMPLETED_STATUSES = new Set(["paid", "refunded"]);

export type AbuseCapReason = "session_cap" | "credit_cap" | "pending_cap";

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
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("stripe_purchases")
    .select("package_size, status, created_at")
    .eq("user_id", userId)
    .gte("created_at", since24h);

  if (error) {
    console.error("[abuse-caps] lookup failed:", error);
    throw new Error("Failed to verify purchase rate limits");
  }

  const rows = data ?? [];
  const completed = rows.filter((row) => COMPLETED_STATUSES.has(row.status));

  if (completed.length >= ABUSE_CAP_SESSIONS_24H) {
    throw new AbuseCapError("session_cap");
  }

  const completedCredits = completed.reduce((sum, row) => sum + row.package_size, 0);
  if (completedCredits + requestedPackageSize > ABUSE_CAP_CREDITS_24H) {
    throw new AbuseCapError("credit_cap");
  }

  // Anti-spam guard on session creation: every checkout click inserts a
  // 'pending' row before any payment, so abandoned sessions must not eat
  // the 24h purchase cap — only a burst of them in a short window is
  // suspicious. Stripe expires our sessions after 1h (see
  // checkout-session-params), so a pending row older than the window is a
  // dead session, not a purchase in progress.
  const oneHourAgoMs = now - 60 * 60 * 1000;
  const pendingRecent = rows.filter(
    (row) => row.status === "pending" && new Date(row.created_at).getTime() >= oneHourAgoMs
  );
  if (pendingRecent.length >= ABUSE_CAP_PENDING_SESSIONS_1H) {
    throw new AbuseCapError("pending_cap");
  }
}
