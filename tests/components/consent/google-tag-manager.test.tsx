import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("next/script", () => ({
  default: ({ children, src, ...props }: { children?: string; src?: string; id?: string }) => (
    <script data-testid={props.id} src={src} {...props}>{children}</script>
  )
}));

import { GoogleTagManager } from "@/components/consent/google-tag-manager";
import { CONSENT_COOKIE_NAME } from "@/lib/consent/types";
import { createConsentState, serializeConsentValue } from "@/lib/consent/storage";

const GTM_ID = "GTM-MGZXZ4PD";

function clearConsentCookie() {
  document.cookie = `${CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0`;
}

function setConsentCookie(analytics: boolean, marketing: boolean) {
  const state = createConsentState({ analytics, marketing }, new Date("2026-06-01T00:00:00Z"));
  document.cookie = `${CONSENT_COOKIE_NAME}=${serializeConsentValue(state)}; Path=/`;
}

/** Runs the inline init script the way the browser would; returns the resulting dataLayer. */
function runInit(container: HTMLElement): { raw: unknown[]; commands: unknown[][] } {
  const init = container.querySelector("script[data-testid='gtm-init']");
  expect(init?.textContent).toBeTruthy();
  new Function(init!.textContent!)();
  const raw = (window as { dataLayer?: unknown[] }).dataLayer ?? [];
  const commands = raw.map((entry) => Array.from(entry as ArrayLike<unknown>));
  return { raw, commands };
}

beforeEach(() => {
  clearConsentCookie();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  document.querySelectorAll("script[src*='googletagmanager']").forEach((s) => s.remove());
  delete (window as { gtag?: unknown }).gtag;
  delete (window as { dataLayer?: unknown }).dataLayer;
});

describe("<GoogleTagManager>", () => {
  it("renders nothing without NEXT_PUBLIC_GTM_ID", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "");
    const { container } = render(<GoogleTagManager />);
    expect(container.querySelector("script[data-testid='gtm-init']")).toBeNull();
  });

  it("injects the GTM container script with the configured id", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", GTM_ID);
    const { container } = render(<GoogleTagManager />);
    const init = container.querySelector("script[data-testid='gtm-init']");
    expect(init?.textContent).toContain("googletagmanager.com/gtm.js?id=");
    expect(init?.textContent).toContain(GTM_ID);

    runInit(container);
    const loaded = document.querySelector("script[src*='googletagmanager.com/gtm.js']");
    expect(loaded?.getAttribute("src")).toBe(`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`);
  });

  it("defaults every Consent Mode v2 signal to denied and redacts ads data before loading", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", GTM_ID);
    const { container } = render(<GoogleTagManager />);
    const { commands } = runInit(container);
    expect(commands).toContainEqual([
      "consent",
      "default",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied"
      }
    ]);
    expect(commands).toContainEqual(["set", "ads_data_redaction", true]);
  });

  it("pushes no consent update before any decision exists", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", GTM_ID);
    const { container } = render(<GoogleTagManager />);
    const { commands } = runInit(container);
    expect(commands.filter((c) => c[0] === "consent" && c[1] === "update")).toEqual([]);
  });

  it("grants all signals from a fully-accepted cookie", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", GTM_ID);
    setConsentCookie(true, true);
    const { container } = render(<GoogleTagManager />);
    const { commands } = runInit(container);
    expect(commands).toContainEqual([
      "consent",
      "update",
      {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
        analytics_storage: "granted"
      }
    ]);
  });

  it("maps marketing-only consent to ad signals while analytics stays denied", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", GTM_ID);
    setConsentCookie(false, true);
    const { container } = render(<GoogleTagManager />);
    const { commands } = runInit(container);
    expect(commands).toContainEqual([
      "consent",
      "update",
      {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
        analytics_storage: "denied"
      }
    ]);
  });

  it("maps analytics-only consent to analytics_storage while ad signals stay denied", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", GTM_ID);
    setConsentCookie(true, false);
    const { container } = render(<GoogleTagManager />);
    const { commands } = runInit(container);
    expect(commands).toContainEqual([
      "consent",
      "update",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "granted"
      }
    ]);
  });

  it("establishes consent defaults before the container starts (ordering)", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", GTM_ID);
    const { container } = render(<GoogleTagManager />);
    const { raw } = runInit(container);
    const idxDefault = raw.findIndex((e) => {
      const a = Array.from(e as ArrayLike<unknown>);
      return a[0] === "consent" && a[1] === "default";
    });
    const idxStart = raw.findIndex(
      (e) => typeof e === "object" && e !== null && (e as Record<string, unknown>).event === "gtm.js"
    );
    expect(idxDefault).toBeGreaterThanOrEqual(0);
    expect(idxStart).toBeGreaterThan(idxDefault);
  });

  it("defines the gtag shim so runtime consent updates have a target", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", GTM_ID);
    const { container } = render(<GoogleTagManager />);
    runInit(container);
    expect(typeof (window as { gtag?: unknown }).gtag).toBe("function");
  });

  it("leaves signals denied when the consent cookie is malformed", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", GTM_ID);
    document.cookie = `${CONSENT_COOKIE_NAME}=not-json; Path=/`;
    const { container } = render(<GoogleTagManager />);
    const { commands } = runInit(container);
    expect(commands.filter((c) => c[0] === "consent" && c[1] === "update")).toEqual([]);
    expect(commands).toContainEqual([
      "consent",
      "default",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied"
      }
    ]);
  });
});
