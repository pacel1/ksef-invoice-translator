import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContactPage } from "@/components/marketing/contact-page";
import { LEGAL_ENTITY } from "@/lib/brand/legal";
import { marketingCopy } from "@/lib/marketing/copy";

describe("<ContactPage>", () => {
  it("renders the PL heading, form, and chrome", () => {
    render(<ContactPage locale="pl" />);
    expect(
      screen.getByRole("heading", { level: 1, name: marketingCopy.pl.contact.heading })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(marketingCopy.pl.contact.emailLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(marketingCopy.pl.contact.messageLabel)).toBeInTheDocument();
    // Subpage chrome: header CTA + footer legal line.
    expect(screen.getByRole("link", { name: "Zaloguj się" })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`NIP ${LEGAL_ENTITY.nip}`))).toBeInTheDocument();
  });

  it("offers a direct mailto fallback to the contact inbox", () => {
    render(<ContactPage locale="pl" />);
    const mailto = screen.getAllByRole("link", {
      name: new RegExp(LEGAL_ENTITY.contactEmail)
    });
    expect(mailto.length).toBeGreaterThanOrEqual(1);
    expect(mailto[0]).toHaveAttribute("href", `mailto:${LEGAL_ENTITY.contactEmail}`);
  });

  it("renders the EN mirror when locale='en'", () => {
    render(<ContactPage locale="en" />);
    expect(
      screen.getByRole("heading", { level: 1, name: marketingCopy.en.contact.heading })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
});
