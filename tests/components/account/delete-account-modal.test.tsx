import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeleteAccountModal } from "@/components/account/delete-account-modal";

const fetchMock = vi.fn();
const locationAssign = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "location", {
    value: { ...window.location, assign: locationAssign, href: "" },
    writable: true,
    configurable: true
  });
  fetchMock.mockReset();
  locationAssign.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const labels = {
  title: "Potwierdź usunięcie konta",
  body: "Wpisz swój adres e-mail, aby potwierdzić.",
  placeholder: "Wpisz adres e-mail",
  confirmAction: "Tak, usuń trwale moje konto",
  cancel: "Anuluj"
};

describe("<DeleteAccountModal>", () => {
  it("renders title + body + cancel + disabled confirm button initially", () => {
    render(
      <DeleteAccountModal
        open={true}
        email="user@firma.pl"
        onClose={vi.fn()}
        labels={labels}
      />
    );
    expect(screen.getByRole("heading", { name: /Potwierdź usunięcie konta/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anuluj/i })).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: /Tak, usuń trwale/i });
    expect(confirm).toBeDisabled();
  });

  it("enables the confirm button only when the typed email matches", () => {
    render(
      <DeleteAccountModal
        open={true}
        email="user@firma.pl"
        onClose={vi.fn()}
        labels={labels}
      />
    );
    const input = screen.getByPlaceholderText(/Wpisz adres e-mail/i);
    const confirm = screen.getByRole("button", { name: /Tak, usuń trwale/i });

    fireEvent.change(input, { target: { value: "user@WRONG.pl" } });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "user@firma.pl" } });
    expect(confirm).not.toBeDisabled();
  });

  it("calls DELETE /api/me/account and redirects on success", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 });
    render(
      <DeleteAccountModal
        open={true}
        email="user@firma.pl"
        onClose={vi.fn()}
        labels={labels}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/Wpisz adres e-mail/i), {
      target: { value: "user@firma.pl" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Tak, usuń trwale/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/me/account",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ confirmEmail: "user@firma.pl" })
        })
      );
    });
    await waitFor(() => {
      expect(locationAssign).toHaveBeenCalledWith("/");
    });
  });

  it("does not render when open=false", () => {
    const { container } = render(
      <DeleteAccountModal
        open={false}
        email="user@firma.pl"
        onClose={vi.fn()}
        labels={labels}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("calls onClose when cancel is clicked", () => {
    const onClose = vi.fn();
    render(
      <DeleteAccountModal
        open={true}
        email="user@firma.pl"
        onClose={onClose}
        labels={labels}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Anuluj/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
