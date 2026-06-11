import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(__dirname, ".env.test"), override: true });

// E2E_PORT runs the suite against a dedicated dev server on another port,
// so a dev server already running on 3000 (e.g. from another checkout)
// is neither reused nor disturbed.
const e2ePort = Number(process.env.E2E_PORT ?? 3000);
const e2eBaseUrl = process.env.E2E_PORT
  ? `http://localhost:${e2ePort}`
  : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: e2eBaseUrl,
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: `npm run dev -- --port ${e2ePort}`,
    url: `http://localhost:${e2ePort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
