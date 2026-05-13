import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let cached: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("Admin client must never be used in the browser.");
  }
  if (!cached) {
    cached = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return cached;
}
