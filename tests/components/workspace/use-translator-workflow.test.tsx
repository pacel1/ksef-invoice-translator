import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTranslatorWorkflow } from "@/components/workspace/use-translator-workflow";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  // jsdom doesn't provide createObjectURL/revokeObjectURL — stub them for the
  // PDF preview useEffect.
  if (!("createObjectURL" in URL)) {
    Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:mock"), configurable: true });
  }
  if (!("revokeObjectURL" in URL)) {
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
  }
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

// Wire fetchMock so any unmatched /api/pdf preview call resolves to an
// ok-but-empty blob — keeps the preview useEffect from polluting tests that
// only care about upload/translate.
function defaultPdfPreviewResponse() {
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob([new Uint8Array(0)], { type: "application/pdf" })
  };
}

describe("useTranslatorWorkflow", () => {
  it("defaults currentLanguage to 'pl' and bilingual to true", () => {
    const { result } = renderHook(() => useTranslatorWorkflow());
    expect(result.current.currentLanguage).toBe("pl");
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
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/upload")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            invoice: { id: "i1", invoiceNumber: "F-1" },
            invoiceId: "i1",
            isNew: true,
            warnings: []
          })
        });
      }
      if (url.includes("/api/translate")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ invoice: { id: "i1", invoiceNumber: "F-1" } })
        });
      }
      // /api/pdf preview call from useEffect
      return Promise.resolve(defaultPdfPreviewResponse());
    });

    const { result } = renderHook(() => useTranslatorWorkflow());

    await act(async () => {
      await result.current.upload(new File(["<x/>"], "x.xml", { type: "application/xml" }));
    });
    expect(result.current.invoiceId).toBe("i1");
    expect(result.current.cachedLanguages.size).toBe(0);

    // Switch to EN — translate should run and cache.
    act(() => {
      result.current.setCurrentLanguage("en");
    });
    await act(async () => {
      await result.current.translateCurrent();
    });
    expect(result.current.cachedLanguages.has("en")).toBe(true);
  });

  it("translateCurrent is a no-op when the current language is already cached", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/upload")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            invoice: { id: "i2", invoiceNumber: "F-2" },
            invoiceId: "i2",
            isNew: true,
            warnings: []
          })
        });
      }
      if (url.includes("/api/translate")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ invoice: { id: "i2" } })
        });
      }
      return Promise.resolve(defaultPdfPreviewResponse());
    });

    const { result } = renderHook(() => useTranslatorWorkflow());
    await act(async () => {
      await result.current.upload(new File(["<x/>"], "x.xml", { type: "application/xml" }));
    });

    // Switch to EN and seed the cache.
    act(() => {
      result.current.setCurrentLanguage("en");
    });
    await act(async () => {
      await result.current.translateCurrent();
    });
    expect(result.current.cachedLanguages.has("en")).toBe(true);

    // Count only translate calls so PDF preview useEffect doesn't interfere.
    const translateCallsBefore = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes("/api/translate")
    ).length;
    await act(async () => {
      await result.current.translateCurrent();
    });
    const translateCallsAfter = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes("/api/translate")
    ).length;
    expect(translateCallsAfter).toBe(translateCallsBefore);
  });

  it("translateCurrent is a no-op when current language is 'pl' (source)", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/upload")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            invoice: { id: "i4" },
            invoiceId: "i4",
            isNew: true,
            warnings: []
          })
        });
      }
      return Promise.resolve(defaultPdfPreviewResponse());
    });

    const { result } = renderHook(() => useTranslatorWorkflow());
    await act(async () => {
      await result.current.upload(new File(["<x/>"], "x.xml"));
    });

    const translateCallsBefore = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes("/api/translate")
    ).length;
    await act(async () => {
      await result.current.translateCurrent();
    });
    const translateCallsAfter = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes("/api/translate")
    ).length;
    expect(translateCallsAfter).toBe(translateCallsBefore);
    expect(result.current.currentLanguage).toBe("pl");
  });

  it("reset clears invoice, messages, status, and cachedLanguages", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/upload")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            invoice: { id: "i3" },
            invoiceId: "i3",
            isNew: true,
            warnings: []
          })
        });
      }
      return Promise.resolve(defaultPdfPreviewResponse());
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
    expect(result.current.currentLanguage).toBe("pl");
  });
});
