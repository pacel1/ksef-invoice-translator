import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { PurchaseConversion } from "@/components/billing/purchase-conversion";

function dataLayer(): Array<Record<string, unknown>> {
  return ((window as { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? []);
}

afterEach(() => {
  cleanup();
  delete (window as { dataLayer?: unknown }).dataLayer;
});

describe("<PurchaseConversion>", () => {
  it("pushes a purchase event carrying the session id as transaction_id", () => {
    render(<PurchaseConversion sessionId="cs_test_123" />);
    expect(dataLayer()).toContainEqual({ event: "purchase", transaction_id: "cs_test_123" });
  });

  it("includes value and currency when provided", () => {
    render(<PurchaseConversion sessionId="cs_test_123" value={124.75} currency="PLN" />);
    expect(dataLayer()).toContainEqual({
      event: "purchase",
      transaction_id: "cs_test_123",
      value: 124.75,
      currency: "PLN"
    });
  });

  it("omits value/currency when value is absent", () => {
    render(<PurchaseConversion sessionId="cs_test_123" />);
    expect(dataLayer()).toContainEqual({ event: "purchase", transaction_id: "cs_test_123" });
  });

  it("ignores a non-positive or non-finite value but still records the conversion", () => {
    render(<PurchaseConversion sessionId="cs_test_123" value={0} currency="PLN" />);
    render(<PurchaseConversion sessionId="cs_test_456" value={Number.NaN} currency="PLN" />);
    expect(dataLayer()).toContainEqual({ event: "purchase", transaction_id: "cs_test_123" });
    expect(dataLayer()).toContainEqual({ event: "purchase", transaction_id: "cs_test_456" });
    expect(dataLayer().some((e) => "value" in e)).toBe(false);
  });

  it("renders no DOM", () => {
    const { container } = render(<PurchaseConversion sessionId="cs_test_123" />);
    expect(container.firstChild).toBeNull();
  });

  it("initialises dataLayer when it does not exist yet", () => {
    delete (window as { dataLayer?: unknown }).dataLayer;
    render(<PurchaseConversion sessionId="cs_test_123" />);
    expect(Array.isArray((window as { dataLayer?: unknown[] }).dataLayer)).toBe(true);
  });

  it("pushes nothing when the session id is an empty string", () => {
    render(<PurchaseConversion sessionId="" />);
    expect(dataLayer().filter((e) => e.event === "purchase")).toEqual([]);
  });

  it("pushes nothing when the session id is undefined", () => {
    render(<PurchaseConversion sessionId={undefined} />);
    expect(dataLayer().filter((e) => e.event === "purchase")).toEqual([]);
  });

  it("pushes the purchase event only once across re-renders", () => {
    const { rerender } = render(<PurchaseConversion sessionId="cs_test_123" />);
    rerender(<PurchaseConversion sessionId="cs_test_123" />);
    expect(dataLayer().filter((e) => e.event === "purchase")).toHaveLength(1);
  });
});
