/**
 * Cookie-consent state for analytics (spec §2, §6).
 *
 * Anonymous visitors run cookieless (memory persistence). Accepting the
 * consent prompt upgrades PostHog to localStorage+cookie persistence.
 * The stored choice itself is functional storage and needs no consent.
 */

export const CONSENT_STORAGE_KEY = "ksef-analytics-consent";
export const CONSENT_REPROMPT_DAYS = 180;

export type ConsentValue = "accepted" | "declined";

export interface ConsentChoice {
  value: ConsentValue;
  at: string; // ISO timestamp of the decision
}

export type AnalyticsPersistence = "memory" | "localStorage+cookie";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readConsentChoice(storage: StorageLike): ConsentChoice | null {
  const raw = storage.getItem(CONSENT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "value" in parsed &&
      "at" in parsed &&
      (parsed.value === "accepted" || parsed.value === "declined") &&
      typeof (parsed as { at: unknown }).at === "string"
    ) {
      return { value: parsed.value, at: (parsed as { at: string }).at };
    }
    return null;
  } catch {
    return null;
  }
}

export function storeConsentChoice(
  storage: StorageLike,
  value: ConsentValue,
  now: Date
): ConsentChoice {
  const choice: ConsentChoice = { value, at: now.toISOString() };
  storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(choice));
  return choice;
}

export function shouldShowConsentPrompt(
  choice: ConsentChoice | null,
  now: Date
): boolean {
  if (!choice) return true;
  if (choice.value === "accepted") return false;
  const decidedAt = new Date(choice.at).getTime();
  if (Number.isNaN(decidedAt)) return true;
  const ageDays = (now.getTime() - decidedAt) / 86_400_000;
  if (ageDays < 0) return true;
  return ageDays > CONSENT_REPROMPT_DAYS;
}

export function persistenceFor(choice: ConsentChoice | null): AnalyticsPersistence {
  return choice?.value === "accepted" ? "localStorage+cookie" : "memory";
}
