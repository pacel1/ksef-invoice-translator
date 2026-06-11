import { describe, it, expect } from "vitest";
import { resolveFromAddress } from "@/lib/email/from-address";

describe("resolveFromAddress", () => {
  it("builds a sender address from the app host and local part", () => {
    expect(resolveFromAddress("https://kseftranslator.pl", "billing")).toBe(
      "KSeF Translator <billing@kseftranslator.pl>"
    );
  });

  it("strips a www prefix from the host", () => {
    expect(resolveFromAddress("https://www.kseftranslator.pl", "billing")).toBe(
      "KSeF Translator <billing@kseftranslator.pl>"
    );
  });

  it("falls back to the Resend sandbox sender for vercel preview hosts", () => {
    expect(resolveFromAddress("https://my-app.vercel.app", "billing")).toContain(
      "onboarding@resend.dev"
    );
  });

  it("falls back to the Resend sandbox sender for localhost", () => {
    expect(resolveFromAddress("http://localhost:3000", "billing")).toContain(
      "onboarding@resend.dev"
    );
  });

  it("falls back to the Resend sandbox sender for an unparseable URL", () => {
    expect(resolveFromAddress("not a url", "billing")).toContain("onboarding@resend.dev");
  });
});
