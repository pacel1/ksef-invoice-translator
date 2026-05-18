import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryFilterBar } from "@/components/history/history-filter-bar";

const labels = {
  searchLabel: "Szukaj numeru faktury",
  searchPlaceholder: "F/24/...",
  fromLabel: "Od",
  toLabel: "Do",
  clearLabel: "Wyczyść filtry"
};

describe("<HistoryFilterBar>", () => {
  it("renders search input + date range inputs", () => {
    render(<HistoryFilterBar labels={labels} onFilterChange={vi.fn()} />);
    expect(screen.getByLabelText(/Szukaj/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Od/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Do/)).toBeInTheDocument();
  });

  it("calls onFilterChange when the search input changes", () => {
    const onFilterChange = vi.fn();
    render(<HistoryFilterBar labels={labels} onFilterChange={onFilterChange} />);
    fireEvent.change(screen.getByLabelText(/Szukaj/i), { target: { value: "F/24" } });
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ search: "F/24" }));
  });

  it("calls onFilterChange when from-date changes", () => {
    const onFilterChange = vi.fn();
    render(<HistoryFilterBar labels={labels} onFilterChange={onFilterChange} />);
    fireEvent.change(screen.getByLabelText(/Od/), { target: { value: "2026-05-01" } });
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ from: "2026-05-01" }));
  });

  it("clears all filters when the clear button is clicked", () => {
    const onFilterChange = vi.fn();
    render(
      <HistoryFilterBar
        labels={labels}
        onFilterChange={onFilterChange}
        initialSearch="F/24"
        initialFrom="2026-05-01"
        initialTo="2026-05-31"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Wyczyść filtry/i }));
    expect(onFilterChange).toHaveBeenCalledWith({
      search: "",
      from: "",
      to: ""
    });
  });
});
