import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTranslatorWorkflow } from "@/components/workspace/use-translator-workflow";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("useTranslatorWorkflow", () => {
  it("defaults currentLanguage to 'en' and bilingual to true", () => {
    const { result } = renderHook(() => useTranslatorWorkflow());
    expect(result.current.currentLanguage).toBe("en");
    expect(result.current.bilingual).toBe(true);
    expect(result.current.cachedLanguages.size).toBe(0);
  });

  it("setCurrentLanguage updates the value", () => {
    const { result } = renderHook(() => useTranslatorWorkflow());
    act(() => {
      result.current.setCurrentLanguage("de");
    });
    expect(result.current.currentLanguage).toBe("de");
  });

  it("setBilingual updates the value", () => {
    const { result } = renderHook(() => useTranslatorWorkflow());
    act(() => {
      result.current.setBilingual(false);
    });
    expect(result.current.bilingual).toBe(false);
  });

  it("adds a language to cachedLanguages after a successful translate", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          invoice: { id: "i1", invoiceNumber: "F-1" },
          invoiceId: "i1",
          isNew: true,
          warnings: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ invoice: { id: "i1", invoiceNumber: "F-1" } })
      });

    const { result } = renderHook(() => useTranslatorWorkflow());

    await act(async () => {
      await result.current.upload(new File(["<x/>"], "x.xml", { type: "application/xml" }));
    });
    expect(result.current.invoiceId).toBe("i1");
    expect(result.current.cachedLanguages.size).toBe(0);

    await act(async () => {
      await result.current.translateCurrent();
    });
    expect(result.current.cachedLanguages.has("en")).toBe(true);
  });

  it("translateCurrent is a no-op when the current language is already cached", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        invoice: { id: "i2", invoiceNumber: "F-2" },
        invoiceId: "i2",
        isNew: true,
        warnings: []
      })
    });

    const { result } = renderHook(() => useTranslatorWorkflow());
    await act(async () => {
      await result.current.upload(new File(["<x/>"], "x.xml", { type: "application/xml" }));
    });

    // Seed the cache.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ invoice: { id: "i2" } })
    });
    await act(async () => {
      await result.current.translateCurrent();
    });
    expect(result.current.cachedLanguages.has("en")).toBe(true);

    fetchMock.mockClear();
    await act(async () => {
      await result.current.translateCurrent();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reset clears invoice, messages, status, and cachedLanguages", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        invoice: { id: "i3" },
        invoiceId: "i3",
        isNew: true,
        warnings: []
      })
    });
    const { result } = renderHook(() => useTranslatorWorkflow());
    await act(async () => {
      await result.current.upload(new File(["<x/>"], "x.xml"));
    });
    expect(result.current.invoiceId).toBe("i3");

    act(() => {
      result.current.reset();
    });
    expect(result.current.invoiceId).toBeNull();
    expect(result.current.cachedLanguages.size).toBe(0);
  });
});
