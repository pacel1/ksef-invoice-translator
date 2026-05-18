import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubProcessorsTable } from "@/components/marketing/sub-processors-table";

const labels = { nameHeader: "Nazwa", roleHeader: "Rola", locationHeader: "Lokalizacja" };
const rows = [
  { name: "Supabase", role: "Storage", location: "Frankfurt" },
  { name: "OpenAI", role: "Translation", location: "USA" }
];

describe("<SubProcessorsTable>", () => {
  it("renders all three column headers", () => {
    render(<SubProcessorsTable labels={labels} rows={rows} />);
    expect(screen.getByRole("columnheader", { name: "Nazwa" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Rola" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Lokalizacja" })).toBeInTheDocument();
  });

  it("renders each row's cells", () => {
    render(<SubProcessorsTable labels={labels} rows={rows} />);
    expect(screen.getByText("Supabase")).toBeInTheDocument();
    expect(screen.getByText("Frankfurt")).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Translation")).toBeInTheDocument();
  });
});
