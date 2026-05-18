import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";

const baseProps = {
  uploading: false,
  onFile: vi.fn(),
  uploadTitle: "Wgraj KSeF FA(3) XML lub PDF",
  uploadHelp: "Przeciągnij plik tutaj albo wybierz z dysku.",
  parsingLabel: "Parsuję…",
  onboardingTitle: "Co dostajesz",
  onboardingItems: ["1 darmowa faktura", "20+ języków", "Dwujęzyczny PDF", "Bez integracji KSeF"]
};

describe("<WorkspaceEmptyState>", () => {
  it("renders the drop zone with title + help", () => {
    render(<WorkspaceEmptyState {...baseProps} />);
    expect(screen.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/Przeciągnij plik tutaj/i)).toBeInTheDocument();
  });

  it("renders the onboarding panel with all 4 items", () => {
    render(<WorkspaceEmptyState {...baseProps} />);
    expect(screen.getByText(/Co dostajesz/i)).toBeInTheDocument();
    for (const item of baseProps.onboardingItems) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it("renders the 'Wypróbuj z przykładem' button when onLoadSample is provided", () => {
    const onLoadSample = vi.fn();
    render(<WorkspaceEmptyState {...baseProps} onLoadSample={onLoadSample} sampleLabel="Wypróbuj z przykładem" />);
    const btn = screen.getByRole("button", { name: /Wypróbuj z przykładem/i });
    fireEvent.click(btn);
    expect(onLoadSample).toHaveBeenCalledTimes(1);
  });

  it("omits the sample button when onLoadSample is not provided", () => {
    render(<WorkspaceEmptyState {...baseProps} />);
    expect(screen.queryByRole("button", { name: /Wypróbuj z przykładem/i })).not.toBeInTheDocument();
  });

  it("calls onFile when a file is selected via the input", () => {
    const onFile = vi.fn();
    render(<WorkspaceEmptyState {...baseProps} onFile={onFile} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["<x/>"], "x.xml", { type: "application/xml" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("renders the parsing state when uploading=true", () => {
    render(<WorkspaceEmptyState {...baseProps} uploading={true} />);
    expect(screen.getByText(/Parsuję…/i)).toBeInTheDocument();
  });
});
