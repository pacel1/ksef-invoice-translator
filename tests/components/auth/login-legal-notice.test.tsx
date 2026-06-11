import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginLegalNotice } from "@/components/auth/login-legal-notice";

describe("<LoginLegalNotice>", () => {
  it("renders the PL acceptance notice with links to /terms and /privacy", () => {
    render(<LoginLegalNotice locale="pl" />);
    expect(screen.getByText(/akceptujesz/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Regulamin/i })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: /Politykę prywatności/i })).toHaveAttribute(
      "href",
      "/privacy"
    );
  });

  it("renders the EN acceptance notice with links to /en/terms and /en/privacy", () => {
    render(<LoginLegalNotice locale="en" />);
    expect(screen.getByText(/accept/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Terms of Service/i })).toHaveAttribute(
      "href",
      "/en/terms"
    );
    expect(screen.getByRole("link", { name: /Privacy Policy/i })).toHaveAttribute(
      "href",
      "/en/privacy"
    );
  });

  it("mentions that registration happens on first sign-in (PL)", () => {
    render(<LoginLegalNotice locale="pl" />);
    expect(screen.getByText(/konto/i)).toBeInTheDocument();
  });
});
