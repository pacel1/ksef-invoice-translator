import { describe, it, expect, vi } from "vitest";
import { sendContactEmail } from "@/lib/contact/send-contact-email";
import { LEGAL_ENTITY } from "@/lib/brand/legal";
import type { EmailSendFn, EmailSendInput } from "@/lib/email/types";

function captureSend(result: { error?: { message: string } } = {}) {
  const sent: EmailSendInput[] = [];
  const send: EmailSendFn = vi.fn(async (input) => {
    sent.push(input);
    return { data: { id: "em_1" }, ...result };
  });
  return { send, sent };
}

const base = {
  email: "jan@firma.pl",
  message: "Dzień dobry, mam pytanie o tłumaczenie faktury.",
  appUrl: "https://tlumaczksef.pl"
};

describe("sendContactEmail", () => {
  it("addresses the message to the company contact inbox", async () => {
    const { send, sent } = captureSend();
    const result = await sendContactEmail({ ...base, send });
    expect(result.ok).toBe(true);
    expect(sent[0].to).toBe(LEGAL_ENTITY.contactEmail);
    expect(sent[0].subject).toContain("jan@firma.pl");
  });

  it("includes the sender's name, email, and message in both bodies", async () => {
    const { send, sent } = captureSend();
    await sendContactEmail({ ...base, name: "Jan Kowalski", send });
    expect(sent[0].text).toContain("Jan Kowalski");
    expect(sent[0].text).toContain("jan@firma.pl");
    expect(sent[0].text).toContain(base.message);
    expect(sent[0].html).toContain("Jan Kowalski");
    expect(sent[0].html).toContain(base.message);
  });

  it("escapes HTML in user-supplied fields", async () => {
    const { send, sent } = captureSend();
    await sendContactEmail({
      ...base,
      name: "<b>x</b>",
      message: "<script>alert(1)</script>",
      send
    });
    expect(sent[0].html).not.toContain("<script>");
    expect(sent[0].html).toContain("&lt;script&gt;");
    expect(sent[0].html).not.toContain("<b>x</b>");
  });

  it("returns ok=false when the provider rejects the send", async () => {
    const { send } = captureSend({ error: { message: "sandbox: recipient not allowed" } });
    const result = await sendContactEmail({ ...base, send });
    expect(result.ok).toBe(false);
  });

  it("returns ok=false when the send function throws", async () => {
    const send: EmailSendFn = vi.fn(async () => {
      throw new Error("network");
    });
    const result = await sendContactEmail({ ...base, send });
    expect(result.ok).toBe(false);
  });
});
