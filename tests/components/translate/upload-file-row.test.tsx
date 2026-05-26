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

  it("renders the number-duplicate message with count + invoiceNumber substituted", () => {
    render(
      <UploadFileRow
        slot={makeSlot({
          status: "duplicate",
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

  it("renders the duplicate secondary line WITHOUT the truncate utility (full text visible)", () => {
    render(
      <UploadFileRow
        slot={makeSlot({
          status: "duplicate",
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
    const secondary = screen.getByText(expected);
    expect(secondary.className).not.toMatch(/truncate/);
  });

  it("renders the error secondary line WITHOUT the truncate utility", () => {
    render(
      <UploadFileRow
        slot={makeSlot({ status: "error", errorMessage: "Long error message that should never be truncated mid-sentence" })}
        copy={t}
        onRemove={vi.fn()}
      />
    );
    const secondary = screen.getByText(/Long error message/);
    expect(secondary.className).not.toMatch(/truncate/);
  });

  it("KEEPS truncate on the parsing and ready secondary lines (short text, room is tight)", () => {
    const { rerender } = render(
      <UploadFileRow
        slot={makeSlot({ status: "parsing" })}
        copy={t}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText(String(t.parsingRow)).className).toMatch(/truncate/);

    rerender(
      <UploadFileRow
        slot={makeSlot({ status: "ready" })}
        copy={t}
        onRemove={vi.fn()}
      />
    );
    // The ready secondary line wraps filename + size in a single <span> child of
    // the <p>; the <p>'s class is what we assert.
    const ready = screen.getByText(/FA-2026-0001\.xml/).closest("p");
    expect(ready?.className).toMatch(/truncate/);
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
