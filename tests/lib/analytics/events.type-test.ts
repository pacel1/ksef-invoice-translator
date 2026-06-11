// Compile-time proofs for the event catalog. This file contains no runtime
// assertions; tsc failing IS the test. The @ts-expect-error lines verify the
// witness rejects missing and extra keys.
import type { AnalyticsEventMap, AnalyticsEventName } from "@/lib/analytics/events";

type Witness = { [K in AnalyticsEventName]: Record<keyof AnalyticsEventMap[K], true> };

// @ts-expect-error missing key: failure_count is required by the witness type
const missingKey: Witness["files_uploaded"] = { file_count: true, success_count: true };

// @ts-expect-error extra key: unknown properties are rejected
const extraKey: Witness["payment_failed"] = { stripe_session_id: true, purchase_id: true, nip: true };

const exact: Witness["translation_batch_cancelled"] = { total: true, done: true };

export type { Witness };
export { missingKey, extraKey, exact };
