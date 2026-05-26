import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NewTranslationLink } from "@/components/workspace/new-translation-link";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh })
}));

describe("<NewTranslationLink>", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it("renders the supplied label", () => {
    render(
      <NewTranslationLink label="+ Nowe tłumaczenie" variant="full" />
    );
    expect(
      screen.getByRole("button", { name: /Nowe tłumaczenie/i })
    ).toBeInTheDocument();
  });

  it("on click, pushes /translate then refreshes", () => {
    render(
      <NewTranslationLink label="+ Nowe tłumaczenie" variant="full" />
    );
    fireEvent.click(screen.getByRole("button", { name: /Nowe tłumaczenie/i }));
    expect(push).toHaveBeenCalledWith("/translate");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("collapsed variant renders an icon-only button with the label as aria-label", () => {
    render(
      <NewTranslationLink label="+ Nowe tłumaczenie" variant="collapsed" />
    );
    const btn = screen.getByRole("button", { name: /Nowe tłumaczenie/i });
    expect(btn).toBeInTheDocument();
    // The visible "+ " prefix is dropped in collapsed mode; only an icon shows.
    expect(btn.textContent?.trim()).toBe("");
  });
});
