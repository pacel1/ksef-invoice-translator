import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ContactForm } from "@/components/marketing/contact-form";
import { marketingCopy } from "@/lib/marketing/copy";

const copy = marketingCopy.pl.contact;

const savedSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(copy.emailLabel), {
    target: { value: "jan@firma.pl" }
  });
  fireEvent.change(screen.getByLabelText(copy.messageLabel), {
    target: { value: "Dzień dobry, mam pytanie o tłumaczenie faktury." }
  });
  fireEvent.click(screen.getByRole("button", { name: copy.submit }));
}

beforeEach(() => {
  // Without a site key the form uses the dev token path (same as DownloadGate).
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
});

afterEach(() => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = savedSiteKey;
  vi.unstubAllGlobals();
});

describe("<ContactForm>", () => {
  it("renders name, email, and message fields plus a submit button", () => {
    render(<ContactForm copy={copy} contactEmail="kontakt@tlumaczksef.pl" />);
    expect(screen.getByLabelText(copy.nameLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.emailLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.messageLabel)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.submit })).toBeInTheDocument();
  });

  it("posts the message and shows the success state", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ContactForm copy={copy} contactEmail="kontakt@tlumaczksef.pl" />);
    fillAndSubmit();
    await waitFor(() => expect(screen.getByText(copy.success)).toBeInTheDocument());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/contact");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      email: "jan@firma.pl",
      message: "Dzień dobry, mam pytanie o tłumaczenie faktury."
    });
    expect(typeof body.turnstileToken).toBe("string");
  });

  it("shows the rate-limited message on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "limit" }), { status: 429 }))
    );
    render(<ContactForm copy={copy} contactEmail="kontakt@tlumaczksef.pl" />);
    fillAndSubmit();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(copy.rateLimited));
  });

  it("shows the error state with a direct mailto fallback on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "boom" }), { status: 502 }))
    );
    render(<ContactForm copy={copy} contactEmail="kontakt@tlumaczksef.pl" />);
    fillAndSubmit();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(copy.error));
    expect(screen.getByRole("link", { name: /kontakt@tlumaczksef\.pl/ })).toHaveAttribute(
      "href",
      "mailto:kontakt@tlumaczksef.pl"
    );
  });
});
