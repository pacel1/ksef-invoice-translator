import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const usePathnameMock = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock()
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

vi.mock("next/script", () => ({
  default: ({ children, src, ...props }: { children?: string; src?: string; id?: string }) => (
    <script data-testid={props.id} src={src} {...props}>{children}</script>
  )
}));

import { ConsentProvider } from "@/components/consent/consent-provider";
import {
  CONSENT_COOKIE_NAME,
  CONSENT_VERSION,
  OPEN_COOKIE_SETTINGS_EVENT
} from "@/lib/consent/types";
import { createConsentState, serializeConsentValue } from "@/lib/consent/storage";

function clearConsentCookie() {
  document.cookie = `${CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0`;
}

function setConsentCookie(analytics: boolean, marketing: boolean, version = CONSENT_VERSION) {
  const state = {
    ...createConsentState({ analytics, marketing }, new Date("2026-06-01T00:00:00Z")),
    version
  };
  document.cookie = `${CONSENT_COOKIE_NAME}=${serializeConsentValue(state)}; Path=/`;
}

function storedConsent(): { analytics: boolean; marketing: boolean } | null {
  const entry = document.cookie
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (!entry) return null;
  return JSON.parse(decodeURIComponent(entry.slice(CONSENT_COOKIE_NAME.length + 1)));
}

function renderProvider() {
  return render(
    <ConsentProvider>
      <main>app content</main>
    </ConsentProvider>
  );
}

beforeEach(() => {
  clearConsentCookie();
  usePathnameMock.mockReturnValue("/");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  delete (window as { gtag?: unknown }).gtag;
  delete (window as { dataLayer?: unknown }).dataLayer;
});

describe("<ConsentProvider> banner visibility", () => {
  it("shows the banner in Polish on first visit", () => {
    renderProvider();
    expect(screen.getByRole("button", { name: "Akceptuję wszystkie" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Odrzucam wszystkie" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "polityce prywatności" })).toHaveAttribute("href", "/privacy");
  });

  it("shows English copy and /en privacy link under /en", () => {
    usePathnameMock.mockReturnValue("/en/pricing");
    renderProvider();
    expect(screen.getByRole("button", { name: "Accept all" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/en/privacy");
  });

  it("does not show the banner when a valid decision cookie exists", () => {
    setConsentCookie(false, false);
    renderProvider();
    expect(screen.queryByRole("button", { name: "Akceptuję wszystkie" })).not.toBeInTheDocument();
  });

  it("re-prompts when the stored consent version is stale", () => {
    setConsentCookie(true, true, CONSENT_VERSION + 1);
    renderProvider();
    expect(screen.getByRole("button", { name: "Akceptuję wszystkie" })).toBeInTheDocument();
  });

  it("always renders children", () => {
    setConsentCookie(true, true);
    renderProvider();
    expect(screen.getByText("app content")).toBeInTheDocument();
  });
});

describe("<ConsentProvider> decisions", () => {
  it("accept all grants every category, persists and hides the banner", () => {
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Akceptuję wszystkie" }));
    expect(storedConsent()).toMatchObject({ analytics: true, marketing: true, necessary: true });
    expect(screen.queryByRole("button", { name: "Akceptuję wszystkie" })).not.toBeInTheDocument();
  });

  it("reject all declines optional categories and persists", () => {
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Odrzucam wszystkie" }));
    expect(storedConsent()).toMatchObject({ analytics: false, marketing: false, necessary: true });
  });

  it("settings modal saves a granular choice", () => {
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Ustawienia" }));
    const dialog = screen.getByRole("dialog", { name: "Ustawienia plików cookies" });
    expect(dialog).toBeInTheDocument();
    const necessarySwitch = screen.getByRole("switch", { name: /Niezbędne/ });
    expect(necessarySwitch).toBeChecked();
    expect(necessarySwitch).toBeDisabled();
    fireEvent.click(screen.getByRole("switch", { name: /Marketingowe/ }));
    fireEvent.click(screen.getByRole("button", { name: "Zapisz wybór" }));
    expect(storedConsent()).toMatchObject({ analytics: false, marketing: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reopens settings from the footer event after a decision was made", () => {
    setConsentCookie(false, false);
    renderProvider();
    fireEvent(window, new Event(OPEN_COOKIE_SETTINGS_EVENT));
    expect(screen.getByRole("dialog", { name: "Ustawienia plików cookies" })).toBeInTheDocument();
  });

  it("pushes a gtag consent update when consent is revoked mid-session", () => {
    setConsentCookie(true, true);
    const gtag = vi.fn();
    (window as unknown as { gtag: typeof gtag }).gtag = gtag;
    renderProvider();
    fireEvent(window, new Event(OPEN_COOKIE_SETTINGS_EVENT));
    fireEvent.click(screen.getByRole("button", { name: "Odrzucam wszystkie" }));
    expect(gtag).toHaveBeenCalledWith("consent", "update", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied"
    });
  });
});

describe("<ConsentProvider> Google Tag Manager gating", () => {
  it("renders no GTM container without the env var even after consent", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "");
    setConsentCookie(true, true);
    const { container } = renderProvider();
    expect(container.querySelector("script[data-testid='gtm-init']")).toBeNull();
  });

  it("mounts the GTM container script when NEXT_PUBLIC_GTM_ID is set", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-MGZXZ4PD");
    const { container } = renderProvider();
    const init = container.querySelector("script[data-testid='gtm-init']");
    expect(init?.textContent).toContain("GTM-MGZXZ4PD");
    expect(init?.textContent).toContain("googletagmanager.com/gtm.js?id=");
  });
});
