import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PublicPricingSlider } from "@/components/marketing/public-pricing-slider";

const labels = {
  packageLabel: "Pakiet",
  totalLabel: "Cena pakietu",
  perInvoiceLabel: "Za fakturę"
};

describe("<PublicPricingSlider>", () => {
  it("starts at the default package size of 25", () => {
    render(<PublicPricingSlider locale="pl" labels={labels} />);
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("25");
  });

  it("renders package + total + per-invoice readouts", () => {
    render(<PublicPricingSlider locale="pl" labels={labels} />);
    expect(screen.getByText("Pakiet")).toBeInTheDocument();
    expect(screen.getByText("Cena pakietu")).toBeInTheDocument();
    expect(screen.getByText("Za fakturę")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("recomputes the total and per-invoice when the slider changes", () => {
    render(<PublicPricingSlider locale="pl" labels={labels} />);
    const slider = screen.getByRole("slider") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "100" } });
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText(/299,00\s+zł/)).toBeInTheDocument();
    expect(screen.getByText(/2,99\s+zł/)).toBeInTheDocument();
  });

  it("formats currency as PLN when locale='en'", () => {
    render(<PublicPricingSlider locale="en" labels={labels} />);
    const slider = screen.getByRole("slider") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "100" } });
    expect(screen.getByText(/PLN\s+299\.00/)).toBeInTheDocument();
    expect(screen.getByText(/PLN\s+2\.99/)).toBeInTheDocument();
  });
});
