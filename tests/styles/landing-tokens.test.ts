import { describe, it, expect } from "vitest";
import config from "@/tailwind.config";

describe("landing design tokens", () => {
  it("exposes the bold-modern brand + ink + paper colors", () => {
    const colors = (config.theme?.extend?.colors ?? {}) as Record<string, unknown>;
    expect(colors.brand).toMatchObject({ DEFAULT: "#4F46E5", hover: "#4338CA", soft: "#EEF0FF" });
    expect(colors.ink).toMatchObject({ DEFAULT: "#0B1020", panel: "#121A2E" });
    expect(colors["paper-soft"]).toBe("#F7F8FB");
    expect(colors.copy).toMatchObject({ DEFAULT: "#475069", muted: "#697386" });
    expect(colors.mint).toBe("#10B981");
  });

  it("registers the heading + dm font families", () => {
    const fonts = (config.theme?.extend?.fontFamily ?? {}) as Record<string, string[]>;
    expect(fonts.heading?.[0]).toBe("var(--font-space-grotesk)");
    expect(fonts.dm?.[0]).toBe("var(--font-dm-sans)");
  });

  it("registers the fluid hero + section font sizes", () => {
    const sizes = (config.theme?.extend?.fontSize ?? {}) as Record<string, unknown>;
    expect(sizes.hero).toBeDefined();
    expect(sizes["h2x"]).toBeDefined();
  });
});
