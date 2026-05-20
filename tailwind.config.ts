import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Stripe-minimal palette — see specs/2026-05-18 §3.1
        surface: "hsl(var(--surface))",
        "surface-muted": "hsl(var(--surface-muted))",
        "text-strong": "hsl(var(--text-strong))",
        text: "hsl(var(--text))",
        "text-muted": "hsl(var(--text-muted))",
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          hover: "hsl(var(--accent-hover))",
          soft: "hsl(var(--accent-soft))"
        },
        success: "hsl(var(--success))",
        danger: "hsl(var(--danger))",
        // Warning — added 2026-05-20 for the Tłumacz redesign (spec §5).
        // Use for "needs attention" states that aren't outright errors,
        // e.g. duplicate file detected during batch upload.
        warning: "hsl(var(--warning))",
        "warning-soft": "hsl(var(--warning-soft))",
        // Legacy shadcn aliases kept for the existing protected layout until Sprint 2/3 replace them.
        // Remove in Sprint 4 cleanup.
        input: "hsl(var(--border))",
        ring: "hsl(var(--accent))",
        foreground: "hsl(var(--text-strong))",
        background: "hsl(var(--surface))",
        primary: { DEFAULT: "hsl(var(--accent))", foreground: "0 0% 100%" },
        muted: { DEFAULT: "hsl(var(--surface-muted))", foreground: "hsl(var(--text-muted))" }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(10, 37, 64, 0.04), 0 1px 3px 0 rgba(10, 37, 64, 0.06)",
        md: "0 4px 6px -1px rgba(10, 37, 64, 0.07), 0 2px 4px -2px rgba(10, 37, 64, 0.05)",
        lg: "0 10px 24px -3px rgba(10, 37, 64, 0.10), 0 4px 8px -4px rgba(10, 37, 64, 0.06)",
        // Legacy alias kept for the existing components until Sprint 2/3.
        soft: "0 1px 2px 0 rgba(10, 37, 64, 0.04), 0 1px 3px 0 rgba(10, 37, 64, 0.06)"
      },
      borderRadius: {
        md: "6px",
        lg: "8px",
        xl: "12px"
      },
      transitionDuration: {
        hover: "150ms",
        layout: "200ms",
        modal: "300ms"
      },
      transitionTimingFunction: {
        "ease-out": "cubic-bezier(0.16, 1, 0.3, 1)"
      },
      fontSize: {
        // Type scale — specs/2026-05-18 §3.2
        display: ["48px", { lineHeight: "56px", fontWeight: "700" }],
        h1: ["32px", { lineHeight: "40px", fontWeight: "700" }],
        h2: ["24px", { lineHeight: "32px", fontWeight: "600" }],
        h3: ["18px", { lineHeight: "28px", fontWeight: "600" }],
        body: ["16px", { lineHeight: "24px", fontWeight: "400" }],
        small: ["14px", { lineHeight: "20px", fontWeight: "400" }],
        micro: ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "number-xl": ["56px", { lineHeight: "64px", fontWeight: "600" }]
      }
    }
  },
  plugins: []
};

export default config;
