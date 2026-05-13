import { createHash } from "node:crypto";

export async function sha256Hex(input: ArrayBuffer | Buffer | Uint8Array): Promise<string> {
  const buffer = input instanceof Buffer ? input : Buffer.from(input as ArrayBuffer);
  return createHash("sha256").update(buffer).digest("hex");
}
