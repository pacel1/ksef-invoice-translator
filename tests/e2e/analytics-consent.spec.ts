import { expect, test, type Page } from "@playwright/test";

// PostHog storage proof: cookieless before consent, persistence upgrade after
// accepting the analytics category, clean storage after rejecting.
// NODE_ENV=development writes a ph_debug localStorage key regardless of
// persistence mode; every storage assertion excludes exactly that key.

const CONSENT_COOKIE = "cookie_consent";

function phStorageKeys(storage: Record<string, unknown>): string[] {
  return Object.keys(storage).filter((k) => k.startsWith("ph_") && k !== "ph_debug");
}

/** Snapshot of localStorage as a plain object, read inside the page. */
function readLocalStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => ({ ...window.localStorage } as Record<string, string>));
}

/** Snapshot of sessionStorage as a plain object, read inside the page. */
function readSessionStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => ({ ...window.sessionStorage } as Record<string, string>));
}

/** ph_* cookies (excluding none here; posthog never names a cookie ph_debug). */
async function phCookies(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.filter((c) => c.name.startsWith("ph_"));
}

/** Parsed consent decision, or null when the cookie is absent. */
async function readConsentCookie(page: Page) {
  const cookies = await page.context().cookies();
  const cookie = cookies.find((c) => c.name === CONSENT_COOKIE);
  if (!cookie) return null;
  return JSON.parse(decodeURIComponent(cookie.value)) as {
    necessary: boolean;
    analytics: boolean;
    marketing: boolean;
  };
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test("landing captures through /ingest without cookies before consent", async ({ page }) => {
  // Register before navigation so the very first capture batch is observed.
  const ingest = page.waitForRequest((req) => req.url().includes("/ingest/"), {
    timeout: 20_000
  });

  await page.goto("/");
  await ingest; // capture flows through the proxy while in memory mode

  // No PostHog cookies before a consent decision.
  expect(await phCookies(page)).toEqual([]);

  // No ph_* localStorage (ph_debug is the dev-only exception and excluded).
  expect(phStorageKeys(await readLocalStorage(page))).toEqual([]);

  // No ph_* sessionStorage: the session-id window keys stay gated in memory mode.
  expect(phStorageKeys(await readSessionStorage(page))).toEqual([]);
});

test("accepting analytics consent upgrades PostHog persistence", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Akceptuję wszystkie" }).click();

  // Decision is stored with analytics enabled.
  await expect
    .poll(async () => (await readConsentCookie(page))?.analytics, { timeout: 10_000 })
    .toBe(true);

  // The persistence migration writes the PostHog store to localStorage.
  await expect
    .poll(async () => phStorageKeys(await readLocalStorage(page)).length, { timeout: 10_000 })
    .toBeGreaterThan(0);

  // localStorage+cookie mode: localStorage is the primary store; a ph_* cookie
  // OR a ph_* localStorage entry must now exist.
  const phLocal = phStorageKeys(await readLocalStorage(page));
  const phCookieList = await phCookies(page);
  expect(phLocal.length > 0 || phCookieList.length > 0).toBe(true);
});

test("rejecting consent keeps PostHog storage clean", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Odrzucam wszystkie" }).click();

  // Decision is stored (analytics declined).
  await expect
    .poll(async () => await readConsentCookie(page), { timeout: 10_000 })
    .not.toBeNull();

  expect(phStorageKeys(await readLocalStorage(page))).toEqual([]);
  expect(phStorageKeys(await readSessionStorage(page))).toEqual([]);
  expect(await phCookies(page)).toEqual([]);

  // Capture still works cookieless after reload; storage stays clean.
  const ingest = page.waitForRequest((req) => req.url().includes("/ingest/"), {
    timeout: 20_000
  });
  await page.reload();
  await ingest;

  expect(phStorageKeys(await readLocalStorage(page))).toEqual([]);
  expect(phStorageKeys(await readSessionStorage(page))).toEqual([]);
  expect(await phCookies(page)).toEqual([]);
});
