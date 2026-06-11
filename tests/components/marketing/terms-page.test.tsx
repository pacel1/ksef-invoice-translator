import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TermsPage } from "@/components/marketing/terms-page";

describe("<TermsPage>", () => {
  it("renders the PL document with the full section list, not a placeholder", () => {
    render(<TermsPage locale="pl" />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Regulamin/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/zostanie dodana przed uruchomieniem/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Reklamacje/i })).toBeInTheDocument();
    expect(document.getElementById("reklamacje")).not.toBeNull();
  });

  it("renders the EN mirror", () => {
    render(<TermsPage locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: /Terms of Service/i })).toBeInTheDocument();
    expect(screen.queryByText(/will be added before/i)).not.toBeInTheDocument();
  });
});
