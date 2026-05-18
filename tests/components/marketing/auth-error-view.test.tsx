import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthErrorView } from "@/components/marketing/auth-error-view";

const copy = {
  title: "Sign-in link problem",
  reasonExpired: { heading: "Link expired", body: "Send a new one.", cta: "Send new link" },
  reasonUsed: { heading: "Link used", body: "Already used.", cta: "Send new link" },
  reasonGeneric: { heading: "Something went wrong", body: "Try again.", cta: "Back" },
  errorIdLabel: "Error ID"
};

describe("<AuthErrorView>", () => {
  it("renders the expired variant", () => {
    render(<AuthErrorView copy={copy} reason="expired" />);
    expect(screen.getByRole("heading", { name: /Link expired/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Send new link/i })).toHaveAttribute("href", "/login");
  });

  it("renders the used variant", () => {
    render(<AuthErrorView copy={copy} reason="used" />);
    expect(screen.getByRole("heading", { name: /Link used/i })).toBeInTheDocument();
  });

  it("falls back to generic for unknown reasons", () => {
    render(<AuthErrorView copy={copy} reason="something-weird" />);
    expect(screen.getByRole("heading", { name: /Something went wrong/i })).toBeInTheDocument();
  });

  it("shows error ID when provided", () => {
    render(<AuthErrorView copy={copy} reason="generic" errorId="ksef-abc-123" />);
    expect(screen.getByText(/ksef-abc-123/)).toBeInTheDocument();
  });

  it("omits error ID block when absent", () => {
    render(<AuthErrorView copy={copy} reason="generic" />);
    expect(screen.queryByText(/Error ID/i)).not.toBeInTheDocument();
  });
});
