import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FounderCard } from "@/components/trust/founder-card";

const baseProps = {
  name: "Jan Kowalski",
  photoUrl: "/founder-placeholder.svg",
  statement: "Prowadzę tłumaczksef.pl od 2025 r. Osobiście czytam każdą wiadomość.",
  contactEmail: "jan@example.test"
};

describe("<FounderCard>", () => {
  it("renders the founder name and statement", () => {
    render(<FounderCard {...baseProps} />);
    expect(screen.getByText("Jan Kowalski")).toBeInTheDocument();
    expect(screen.getByText(/Osobiście czytam/i)).toBeInTheDocument();
  });

  it("renders the photo with alt text matching the name", () => {
    render(<FounderCard {...baseProps} />);
    const img = screen.getByRole("img", { name: /Jan Kowalski/i });
    expect(img).toHaveAttribute("src", expect.stringContaining("founder-placeholder.svg"));
  });

  it("renders the contact email as a mailto link", () => {
    render(<FounderCard {...baseProps} />);
    const link = screen.getByRole("link", { name: /jan@example\.test/i });
    expect(link).toHaveAttribute("href", "mailto:jan@example.test");
  });
});
