import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import tailwindConfig from "@/tailwind.config";

/**
 * Tokens contract for the Tłumacz redesign.
 *
 * The redesign spec (docs/superpowers/specs/2026-05-20-tlumacz-workspace-redesign.md §5)
 * introduces a new semantic warning token. Verify both layers stay in sync:
 *   1. `app/globals.css` declares the CSS variables under `:root`.
 *   2. `tailwind.config.ts` re-exports them as `theme.extend.colors`.
 *
 * A mismatch between the two breaks the `bg-warning` / `text-warning` utility classes
 * at runtime — failing here is cheaper than catching it visually in CI.
 */
describe("design tokens — warning palette", () => {
  it("declares --warning and --warning-soft CSS variables in globals.css", () => {
    const css = readFileSync(
      path.resolve(process.cwd(), "app/globals.css"),
      "utf-8"
    );
    expect(css).toMatch(/--warning:\s*38\s+92%\s+50%;/);
    expect(css).toMatch(/--warning-soft:\s*38\s+92%\s+95%;/);
  });

  it("exposes the warning colors via tailwind theme.extend.colors", () => {
    const extend = tailwindConfig.theme?.extend as
      | { colors?: Record<string, unknown> }
      | undefined;
    const colors = extend?.colors ?? {};
    expect(colors.warning).toBe("hsl(var(--warning))");
    expect(colors["warning-soft"]).toBe("hsl(var(--warning-soft))");
  });
});
