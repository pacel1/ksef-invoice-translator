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

/** Executes the inline bootstrap the way a browser would and returns dataLayer commands. */
function runBootstrap(container: HTMLElement): unknown[][] {
  const bootstrap = container.querySelector("script[data-testid='google-ads-bootstrap']");
  expect(bootstrap?.textContent).toBeTruthy();
  new Function(bootstrap!.textContent!)();
  const dataLayer = (window as { dataLayer?: unknown[] }).dataLayer ?? [];
  return dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>));
}

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

describe("<ConsentProvider> Google Ads tag gating", () => {
  it("renders no Google scripts without the env var even after consent", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", "");
    setConsentCookie(true, true);
    const { container } = renderProvider();
    expect(container.querySelector("script[src*='googletagmanager']")).toBeNull();
  });

  it("loads gtag.js before any consent decision with every signal denied (advanced consent mode)", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", "AW-18231110784");
    const { container } = renderProvider();
    expect(container.querySelector("script[src*='googletagmanager']")).not.toBeNull();
    const commands = runBootstrap(container);
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
    expect(commands.filter((c) => c[0] === "consent" && c[1] === "update")).toEqual([]);
    expect(commands).toContainEqual(["set", "ads_data_redaction", true]);
    expect(commands).toContainEqual(["config", "AW-18231110784"]);
  });

  it("loads gtag.js once marketing is granted; bootstrap defaults to denied then grants from the cookie", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", "AW-18231110784");
    const { container } = renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Akceptuję wszystkie" }));
    const loader = container.querySelector("script[src*='googletagmanager']");
    expect(loader).not.toBeNull();
    expect(loader?.getAttribute("src")).toContain("AW-18231110784");

    const commands = runBootstrap(container);
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
    expect(commands).toContainEqual(["config", "AW-18231110784"]);
  });

  it("keeps analytics_storage denied when only marketing was granted", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", "AW-18231110784");
    setConsentCookie(false, true);
    const { container } = renderProvider();
    const commands = runBootstrap(container);
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

  it("honours a revocation that lands before the bootstrap executes (race safety)", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", "AW-18231110784");
    const { container } = renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Akceptuję wszystkie" }));
    const bootstrapText = container.querySelector("script[data-testid='google-ads-bootstrap']")?.textContent;
    expect(bootstrapText).toBeTruthy();

    // User revokes before the injected script has run: the cookie now says denied.
    fireEvent(window, new Event(OPEN_COOKIE_SETTINGS_EVENT));
    fireEvent.click(screen.getByRole("button", { name: "Odrzucam wszystkie" }));

    // The stale bootstrap executes afterwards; it must read the live cookie, not render-time state.
    new Function(bootstrapText!)();
    const dataLayer = (window as { dataLayer?: unknown[] }).dataLayer ?? [];
    const commands = dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>));
    const lastConsentCommand = commands.filter((c) => c[0] === "consent").pop();
    expect(lastConsentCommand?.[2]).toMatchObject({ ad_storage: "denied", analytics_storage: "denied" });
  });
});
