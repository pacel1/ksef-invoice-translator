import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CreditPurchaseDrawer } from "@/components/billing/credit-purchase-drawer";

const sliderLabels = {
  pickPackageLabel: "Wybierz pakiet",
  unitPriceLabel: "za fakturę (netto)",
  totalLabel: "Razem (netto)",
  totalWithTaxLabel: "Z 23% VAT",
  continueLabel: "Przejdź do płatności"
};

const drawerLabels = {
  title: "Doładuj kredyty",
  closeLabel: "Zamknij"
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("<CreditPurchaseDrawer>", () => {
  it("does not render content when closed", () => {
    const { container } = render(
      <CreditPurchaseDrawer sliderLabels={sliderLabels} labels={drawerLabels} />
    );
    expect(container.querySelector('[data-drawer-open="true"]')).toBeNull();
  });

  it("opens when 'open-credit-drawer' event fires", () => {
    render(<CreditPurchaseDrawer sliderLabels={sliderLabels} labels={drawerLabels} />);
    act(() => {
      window.dispatchEvent(new CustomEvent("open-credit-drawer"));
    });
    expect(document.querySelector('[data-drawer-open="true"]')).not.toBeNull();
    expect(screen.getByRole("heading", { name: /Doładuj kredyty/i })).toBeInTheDocument();
  });

  it("closes when the X button is clicked", () => {
    render(<CreditPurchaseDrawer sliderLabels={sliderLabels} labels={drawerLabels} />);
    act(() => {
      window.dispatchEvent(new CustomEvent("open-credit-drawer"));
    });
    fireEvent.click(screen.getByRole("button", { name: /Zamknij/i }));
    expect(document.querySelector('[data-drawer-open="true"]')).toBeNull();
  });

  it("renders the CreditSlider inside the drawer when open", () => {
    render(<CreditPurchaseDrawer sliderLabels={sliderLabels} labels={drawerLabels} />);
    act(() => {
      window.dispatchEvent(new CustomEvent("open-credit-drawer"));
    });
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });
});
