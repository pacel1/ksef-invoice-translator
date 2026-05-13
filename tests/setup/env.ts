import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.test"), override: true });

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required test env var: ${key}. Did you run 'npm run db:start' and copy keys into .env.test?`);
  }
}
