import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketingFAQ } from "@/components/marketing/marketing-faq";

const items = [
  { q: "Pytanie pierwsze?", a: "Odpowiedź pierwsza." },
  { q: "Pytanie drugie?", a: "Odpowiedź druga." }
];

describe("<MarketingFAQ>", () => {
  it("renders the heading and all questions", () => {
    render(<MarketingFAQ heading="FAQ test" items={items} />);
    expect(screen.getByRole("heading", { name: /FAQ test/i })).toBeInTheDocument();
    expect(screen.getByText("Pytanie pierwsze?")).toBeInTheDocument();
    expect(screen.getByText("Pytanie drugie?")).toBeInTheDocument();
  });

  it("renders the answers inside <details> elements", () => {
    render(<MarketingFAQ heading="X" items={items} />);
    const details = document.querySelectorAll("details");
    expect(details.length).toBe(2);
    expect(details[0].textContent).toContain("Odpowiedź pierwsza.");
  });

  it("uses semantic <summary> for the question", () => {
    render(<MarketingFAQ heading="X" items={items} />);
    const summaries = document.querySelectorAll("summary");
    expect(summaries.length).toBe(2);
    expect(summaries[0].textContent).toContain("Pytanie pierwsze?");
  });
});
