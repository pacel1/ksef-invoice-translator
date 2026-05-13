import { createHash } from "node:crypto";

export async function sha256Hex(input: ArrayBuffer | Buffer | Uint8Array): Promise<string> {
  const buffer =
    input instanceof Buffer
      ? input
      : input instanceof Uint8Array
        ? Buffer.from(input)
        : Buffer.from(input);
  return createHash("sha256").update(buffer).digest("hex");
}
