import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrivacyPage } from "@/components/marketing/privacy-page";

describe("<PrivacyPage>", () => {
  it("renders the PL document with the full section list, not a placeholder", () => {
    render(<PrivacyPage locale="pl" />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Polityka prywatności/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/zostanie dodana przed uruchomieniem/i)).not.toBeInTheDocument();
    expect(document.getElementById("administrator")).not.toBeNull();
    expect(screen.getAllByText(/RODO/).length).toBeGreaterThan(0);
  });

  it("renders the EN mirror", () => {
    render(<PrivacyPage locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: /Privacy Policy/i })).toBeInTheDocument();
    expect(screen.queryByText(/will be added before/i)).not.toBeInTheDocument();
  });
});
