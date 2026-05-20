import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UploadStep } from "@/components/translate/upload-step";
import { copy } from "@/lib/workspace/copy";
import type { FileSlot } from "@/components/translate/use-translation-wizard";

const t = copy.pl;

function makeSlot(overrides: Partial<FileSlot> = {}): FileSlot {
  const file = new File(["x"], "f.xml", { type: "application/xml" });
  return {
    localId: `slot-${Math.random()}`,
    file,
    status: "ready",
    invoiceNumber: "FA-1",
    ...overrides
  };
}

describe("<UploadStep>", () => {
  it("renders the empty hero drop zone when no files are present", () => {
    render(
      <UploadStep
        files={[]}
        copy={t}
        onAddFiles={vi.fn()}
        onRemoveFile={vi.fn()}
        onClearAll={vi.fn()}
        onNext={vi.fn()}
      />
    );
    expect(screen.getByText(String(t.uploadHeading))).toBeInTheDocument();
    expect(screen.getByText(String(t.uploadDropHint))).toBeInTheDocument();
    expect(screen.queryByTestId("upload-file-list")).not.toBeInTheDocument();
  });

  it("renders the data-immutable trust notice in the empty state", () => {
    render(
      <UploadStep
        files={[]}
        copy={t}
        onAddFiles={vi.fn()}
        onRemoveFile={vi.fn()}
        onClearAll={vi.fn()}
        onNext={vi.fn()}
      />
    );
    expect(screen.getByText(String(t.dataImmutableNotice))).toBeInTheDocument();
  });

  it("switches to the file-list layout once files are present", () => {
    render(
      <UploadStep
        files={[makeSlot(), makeSlot({ invoiceNumber: "FA-2" })]}
        copy={t}
        onAddFiles={vi.fn()}
        onRemoveFile={vi.fn()}
        onClearAll={vi.fn()}
        onNext={vi.fn()}
      />
    );
    expect(screen.getByTestId("upload-file-list")).toBeInTheDocument();
    // Hero drop zone is gone; only the compact add-more zone is left.
    expect(screen.queryByText(String(t.uploadDropHint))).not.toBeInTheDocument();
  });

  it("displays the ready-count copy keyed on count", () => {
    render(
      <UploadStep
        files={[makeSlot(), makeSlot({ invoiceNumber: "FA-2" })]}
        copy={t}
        onAddFiles={vi.fn()}
        onRemoveFile={vi.fn()}
        onClearAll={vi.fn()}
        onNext={vi.fn()}
      />
    );
    // PL plural ("2 plików gotowych do tłumaczenia")
    expect(screen.getByText(/2 plików/)).toBeInTheDocument();
  });

  it("disables the Continue CTA when no files are ready", () => {
    render(
      <UploadStep
        files={[makeSlot({ status: "parsing" })]}
        copy={t}
        onAddFiles={vi.fn()}
        onRemoveFile={vi.fn()}
        onClearAll={vi.fn()}
        onNext={vi.fn()}
      />
    );
    const cta = screen.getByRole("button", { name: String(t.continueCta) });
    expect(cta).toBeDisabled();
  });

  it("enables the Continue CTA when at least one file is ready", () => {
    render(
      <UploadStep
        files={[makeSlot({ status: "ready" })]}
        copy={t}
        onAddFiles={vi.fn()}
        onRemoveFile={vi.fn()}
        onClearAll={vi.fn()}
        onNext={vi.fn()}
      />
    );
    const cta = screen.getByRole("button", { name: String(t.continueCta) });
    expect(cta).not.toBeDisabled();
  });

  it("invokes onNext when the user clicks Continue", () => {
    const onNext = vi.fn();
    render(
      <UploadStep
        files={[makeSlot({ status: "ready" })]}
        copy={t}
        onAddFiles={vi.fn()}
        onRemoveFile={vi.fn()}
        onClearAll={vi.fn()}
        onNext={onNext}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: String(t.continueCta) }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("invokes onClearAll when the user clicks Wyczyść", () => {
    const onClearAll = vi.fn();
    render(
      <UploadStep
        files={[makeSlot()]}
        copy={t}
        onAddFiles={vi.fn()}
        onRemoveFile={vi.fn()}
        onClearAll={onClearAll}
        onNext={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: String(t.clearAllCta) }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("calls onAddFiles when the user drops files onto the drop zone", () => {
    const onAddFiles = vi.fn();
    render(
      <UploadStep
        files={[]}
        copy={t}
        onAddFiles={onAddFiles}
        onRemoveFile={vi.fn()}
        onClearAll={vi.fn()}
        onNext={vi.fn()}
      />
    );
    const dropZone = screen.getByTestId("upload-dropzone");
    const file = new File(["x"], "a.xml", { type: "application/xml" });
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file], items: [] }
    });
    expect(onAddFiles).toHaveBeenCalledTimes(1);
    expect(onAddFiles.mock.calls[0][0]).toHaveLength(1);
  });

  it("calls onRemoveFile when a file row's remove button is clicked", () => {
    const onRemoveFile = vi.fn();
    const slot = makeSlot({ localId: "slot-77" });
    render(
      <UploadStep
        files={[slot]}
        copy={t}
        onAddFiles={vi.fn()}
        onRemoveFile={onRemoveFile}
        onClearAll={vi.fn()}
        onNext={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Usuń/ }));
    expect(onRemoveFile).toHaveBeenCalledWith("slot-77");
  });
});
