import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(__dirname, ".env.test"), override: true });

// E2E_PORT runs the suite against a dedicated dev server on another port,
// so a dev server already running on 3000 (e.g. from another checkout)
// is neither reused nor disturbed. App-side absolute URLs still read
// NEXT_PUBLIC_APP_URL; set it too if a test needs them to match the port.
const rawE2ePort = process.env.E2E_PORT;
const e2ePort = rawE2ePort ? Number(rawE2ePort) : 3000;
if (rawE2ePort && !Number.isInteger(e2ePort)) {
  throw new Error(`E2E_PORT must be an integer, got "${rawE2ePort}"`);
}
const e2eBaseUrl = rawE2ePort
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
