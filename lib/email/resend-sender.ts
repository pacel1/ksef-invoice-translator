import { Resend } from "resend";
import type { EmailSendFn, EmailSendResult } from "./types";

/**
 * Thin adapter from the Resend SDK to the injectable EmailSendFn shape.
 * Returns null when no API key is configured so callers can degrade
 * gracefully (e.g. best-effort sends skip instead of crashing).
 */
export function createResendSendFn(apiKey: string | undefined): EmailSendFn | null {
  if (!apiKey) return null;
  const resend = new Resend(apiKey);
  return async (input) => {
    const out = await resend.emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text
    });
    return out as EmailSendResult;
  };
}
