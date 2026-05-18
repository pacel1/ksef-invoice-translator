import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorPage from "@/app/error";

const sampleError = Object.assign(new Error("boom"), { digest: "ksef-abc123" });

describe("app/error.tsx", () => {
  it("renders 500 + title + retry button + error ID", () => {
    const reset = vi.fn();
    render(<ErrorPage error={sampleError} reset={reset} />);
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Coś poszło nie tak/i })).toBeInTheDocument();
    expect(screen.getByText(/ksef-abc123/i)).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: /Spróbuj ponownie/i });
    expect(retry).toBeInTheDocument();
    fireEvent.click(retry);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders the back-home link", () => {
    render(<ErrorPage error={sampleError} reset={vi.fn()} />);
    const home = screen.getByRole("link", { name: /Wracam na stronę główną/i });
    expect(home).toHaveAttribute("href", "/");
  });

  it("omits the error ID block when no digest is present", () => {
    const errorWithoutDigest = new Error("no digest");
    render(<ErrorPage error={errorWithoutDigest} reset={vi.fn()} />);
    expect(screen.queryByText(/ID błędu/i)).not.toBeInTheDocument();
  });
});
