import { LEGAL_ENTITY } from "@/lib/brand/legal";
import { resolveFromAddress } from "@/lib/email/from-address";
import type { EmailSendFn } from "@/lib/email/types";

export interface SendContactEmailInput {
  name?: string;
  email: string;
  message: string;
  send: EmailSendFn;
  appUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Forward a contact-form submission to the company inbox. The visitor's
 * address goes into the subject and body (EmailSendInput has no reply-to),
 * and all user-supplied fields are HTML-escaped before rendering.
 */
export async function sendContactEmail(input: SendContactEmailInput): Promise<{ ok: boolean }> {
  const sender = input.name ? `${input.name} <${input.email}>` : input.email;
  const text = `Od: ${sender}\n\n${input.message}`;
  const html = [
    `<p><strong>Od:</strong> ${escapeHtml(sender)}</p>`,
    `<p style="white-space: pre-wrap;">${escapeHtml(input.message)}</p>`
  ].join("\n");

  try {
    const result = await input.send({
      from: resolveFromAddress(input.appUrl, "kontakt"),
      to: LEGAL_ENTITY.contactEmail,
      subject: `Wiadomość z formularza kontaktowego: ${input.email}`,
      html,
      text
    });
    if (result.error) {
      console.error("[contact] provider rejected contact email", result.error);
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error("[contact] contact email send threw", error);
    return { ok: false };
  }
}
