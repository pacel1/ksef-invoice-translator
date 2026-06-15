import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { GtmNoScript } from "@/components/consent/gtm-noscript";

const GTM_ID = "GTM-MGZXZ4PD";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("<GtmNoScript>", () => {
  it("renders nothing without NEXT_PUBLIC_GTM_ID", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "");
    const { container } = render(<GtmNoScript />);
    expect(container.querySelector("noscript")).toBeNull();
  });

  it("renders the GTM fallback iframe for the configured id", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", GTM_ID);
    const { container } = render(<GtmNoScript />);
    const noscript = container.querySelector("noscript");
    expect(noscript).not.toBeNull();
    expect(noscript!.innerHTML).toContain(
      `https://www.googletagmanager.com/ns.html?id=${GTM_ID}`
    );
    expect(noscript!.innerHTML).toContain("display:none");
  });
});
