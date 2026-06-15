import { describe, it, expect } from "vitest";
import { resolveGtmId } from "@/lib/consent/gtm";

describe("resolveGtmId", () => {
  it("returns a well-formed container id unchanged", () => {
    expect(resolveGtmId("GTM-MGZXZ4PD")).toBe("GTM-MGZXZ4PD");
  });

  it("returns null for undefined", () => {
    expect(resolveGtmId(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(resolveGtmId("")).toBeNull();
  });

  it("rejects ids that do not match the GTM-XXXX shape", () => {
    expect(resolveGtmId("gtm-mgzxz4pd")).toBeNull(); // lowercase
    expect(resolveGtmId("AW-18231110784")).toBeNull(); // an Ads id, not a container
    expect(resolveGtmId("GTM_MGZXZ4PD")).toBeNull(); // wrong separator
    expect(resolveGtmId("GTM-")).toBeNull(); // empty suffix
    expect(resolveGtmId(" GTM-MGZXZ4PD ")).toBeNull(); // surrounding whitespace
  });

  it("rejects values carrying script-breaking characters", () => {
    expect(resolveGtmId("GTM-X');alert(1)//")).toBeNull();
    expect(resolveGtmId('GTM-X"></iframe>')).toBeNull();
  });
});
