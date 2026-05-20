import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UploadFileRow } from "@/components/translate/upload-file-row";
import { copy } from "@/lib/workspace/copy";
import type { FileSlot } from "@/components/translate/use-translation-wizard";

const t = copy.pl;

function makeSlot(overrides: Partial<FileSlot> = {}): FileSlot {
  const file = new File(["x"], "FA-2026-0001.xml", { type: "application/xml" });
  return {
    localId: "slot-1",
    file,
    status: "ready",
    invoiceNumber: "FA-2026-0001",
    ...overrides
  };
}

describe("<UploadFileRow>", () => {
  it("renders parsing state with spinner and filename", () => {
    render(
      <UploadFileRow
        slot={makeSlot({ status: "parsing" })}
        copy={t}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText("FA-2026-0001.xml")).toBeInTheDocument();
    expect(screen.getByTestId("file-row-spinner")).toBeInTheDocument();
  });

  it("renders ready state with checkmark and file size", () => {
    const file = new File([new Uint8Array(2048)], "abc.xml", {
      type: "application/xml"
    });
    render(
      <UploadFileRow
        slot={makeSlot({ status: "ready", file })}
        copy={t}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText(/abc\.xml/)).toBeInTheDocument();
    expect(screen.getByTestId("file-row-check")).toBeInTheDocument();
    // 2048 bytes formats as "2 KB"
    expect(screen.getByText(/2 KB/i)).toBeInTheDocument();
  });

  it("renders error state with danger icon and the message", () => {
    render(
      <UploadFileRow
        slot={makeSlot({ status: "error", errorMessage: "Bad XML schema" })}
        copy={t}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText("Bad XML schema")).toBeInTheDocument();
    expect(screen.getByTestId("file-row-error")).toBeInTheDocument();
  });

  it("renders duplicate state with warning treatment and the duplicate message", () => {
    render(
      <UploadFileRow
        slot={makeSlot({ status: "duplicate" })}
        copy={t}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText(String(t.duplicateRow))).toBeInTheDocument();
    expect(screen.getByTestId("file-row-warning")).toBeInTheDocument();
  });

  it("renders the content-duplicate message when isContentDuplicate=true", () => {
    render(
      <UploadFileRow
        slot={makeSlot({
          status: "duplicate",
          isContentDuplicate: true,
          otherWithSameNumber: 0
        })}
        copy={t}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText(String(t.duplicateContentRow))).toBeInTheDocument();
  });

  it("renders the number-duplicate message with count + invoiceNumber substituted", () => {
    render(
      <UploadFileRow
        slot={makeSlot({
          status: "duplicate",
          isContentDuplicate: false,
          otherWithSameNumber: 3,
          invoiceNumber: "FA/30/05/2026"
        })}
        copy={t}
        onRemove={vi.fn()}
      />
    );
    const expected = String(t.duplicateNumberRow)
      .replace("{count}", "3")
      .replace("{invoiceNumber}", "FA/30/05/2026");
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("remove button has an aria-label including the filename", () => {
    render(
      <UploadFileRow slot={makeSlot()} copy={t} onRemove={vi.fn()} />
    );
    const btn = screen.getByRole("button", { name: /Usuń.*FA-2026-0001\.xml/ });
    expect(btn).toBeInTheDocument();
  });

  it("clicking remove calls onRemove with the slot localId", () => {
    const onRemove = vi.fn();
    render(
      <UploadFileRow
        slot={makeSlot({ localId: "slot-xyz" })}
        copy={t}
        onRemove={onRemove}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Usuń/ }));
    expect(onRemove).toHaveBeenCalledWith("slot-xyz");
  });

  it("uses invoiceNumber as the visible primary label when present", () => {
    const slot = makeSlot({
      status: "ready",
      invoiceNumber: "FA-2026-9999"
    });
    render(<UploadFileRow slot={slot} copy={t} onRemove={vi.fn()} />);
    expect(screen.getByText("FA-2026-9999")).toBeInTheDocument();
  });

  it("falls back to the file name when invoiceNumber is missing", () => {
    const slot = makeSlot({
      status: "parsing",
      invoiceNumber: undefined
    });
    render(<UploadFileRow slot={slot} copy={t} onRemove={vi.fn()} />);
    expect(screen.getByText("FA-2026-0001.xml")).toBeInTheDocument();
  });
});
