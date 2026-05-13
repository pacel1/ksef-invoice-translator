import { describe, it, expect } from "vitest";
import { sha256Hex } from "@/lib/invoice/source-hash";

describe("sha256Hex", () => {
  it("returns the lowercase hex digest of a Buffer", async () => {
    const buf = Buffer.from("hello", "utf8");
    const hex = await sha256Hex(buf);
    expect(hex).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("returns the same digest for an ArrayBuffer view of the same bytes", async () => {
    const buf = Buffer.from("hello world", "utf8");
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    expect(await sha256Hex(buf)).toBe(await sha256Hex(ab));
  });

  it("is deterministic across calls", async () => {
    const buf = Buffer.from("sample-fa3-xml", "utf8");
    const a = await sha256Hex(buf);
    const b = await sha256Hex(buf);
    expect(a).toBe(b);
  });
});
