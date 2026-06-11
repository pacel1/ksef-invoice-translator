/**
 * Server-side analytics API (route handlers and server actions only).
 *
 * Captures are deferred with after() so they never delay the response, and
 * flushed inside the callback so events are not lost when the serverless
 * function freezes (the wizard baseline fired-and-forgot). Analytics must
 * never break a request: failures are logged and swallowed.
 *
 * Must be called within a request scope (route handler or server action);
 * out-of-scope calls are logged and dropped.
 */
import { after } from "next/server";
import { PostHog } from "posthog-node";
import type { AnalyticsEventMap, AnalyticsEventName } from "./events";

let client: PostHog | null = null;

function getPostHogServerClient(): PostHog {
  if (!client) {
    const key = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key || !host) {
      throw new Error(
        "PostHog server capture requires NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN and NEXT_PUBLIC_POSTHOG_HOST"
      );
    }
    // flushInterval: 0 disables the background timer; we flush explicitly in after()
    client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  }
  return client;
}

export interface ServerCaptureArgs<E extends AnalyticsEventName> {
  distinctId: string;
  event: E;
  properties: AnalyticsEventMap[E];
  /** posthog-js session id forwarded by the client (POSTHOG_SESSION_HEADER). */
  sessionId?: string;
}

export function captureServer<E extends AnalyticsEventName>(
  args: ServerCaptureArgs<E>
): void {
  let posthog: PostHog;
  try {
    posthog = getPostHogServerClient();
  } catch (error) {
    console.error("[analytics] server capture skipped:", error);
    return;
  }

  const properties = args.sessionId
    ? { ...args.properties, $session_id: args.sessionId }
    : { ...args.properties };

  try {
    after(async () => {
      try {
        posthog.capture({
          distinctId: args.distinctId,
          event: args.event,
          properties
        });
        await posthog.flush();
      } catch (error) {
        console.error(`[analytics] failed to flush ${args.event}:`, error);
      }
    });
  } catch (error) {
    console.error(
      `[analytics] could not schedule capture for ${args.event} (must be called within a request scope):`,
      error
    );
  }
}
