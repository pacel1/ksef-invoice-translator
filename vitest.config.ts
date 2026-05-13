import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    environmentMatchGlobs: [["tests/components/**", "jsdom"]],
    globals: true,
    setupFiles: ["tests/setup/env.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 15_000
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
