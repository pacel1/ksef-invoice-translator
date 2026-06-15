import { describe, it, expect } from "vitest";
import { GET } from "@/app/llms.txt/route";
import { buildLlmsTxt } from "@/lib/seo/llms-txt";

describe("/llms.txt route", () => {
  it("serves the llms.txt body as UTF-8 plain text", async () => {
    const res = GET();
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe(buildLlmsTxt());
  });
});
