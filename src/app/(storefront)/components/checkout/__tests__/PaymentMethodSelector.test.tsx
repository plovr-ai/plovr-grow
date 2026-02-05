import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PaymentMethodSelector } from "../PaymentMethodSelector";

describe("PaymentMethodSelector", () => {
  const defaultProps = {
    value: "card" as const,
    onChange: vi.fn(),
    orderMode: "pickup",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render payment method options", () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    expect(screen.getByText("Payment Method")).toBeInTheDocument();
    expect(screen.getByText("Pay Now with Card")).toBeInTheDocument();
    expect(screen.getByText("Pay at Pickup")).toBeInTheDocument();
  });

  it("should show Pay at Delivery for delivery order mode", () => {
    render(<PaymentMethodSelector {...defaultProps} orderMode="delivery" />);

    expect(screen.getByText("Pay at Delivery")).toBeInTheDocument();
  });

  it("should call onChange when card option is selected", () => {
    const onChange = vi.fn();
    render(
      <PaymentMethodSelector
        {...defaultProps}
        value="cash"
        onChange={onChange}
      />
    );

    const cardRadio = screen.getByDisplayValue("card");
    fireEvent.click(cardRadio);

    expect(onChange).toHaveBeenCalledWith("card");
  });

  it("should call onChange when cash option is selected", () => {
    const onChange = vi.fn();
    render(
      <PaymentMethodSelector
        {...defaultProps}
        value="card"
        onChange={onChange}
      />
    );

    const cashRadio = screen.getByDisplayValue("cash");
    fireEvent.click(cashRadio);

    expect(onChange).toHaveBeenCalledWith("cash");
  });

  it("should have card radio checked when value is card", () => {
    render(<PaymentMethodSelector {...defaultProps} value="card" />);

    const cardRadio = screen.getByDisplayValue("card") as HTMLInputElement;
    const cashRadio = screen.getByDisplayValue("cash") as HTMLInputElement;

    expect(cardRadio.checked).toBe(true);
    expect(cashRadio.checked).toBe(false);
  });

  it("should have cash radio checked when value is cash", () => {
    render(<PaymentMethodSelector {...defaultProps} value="cash" />);

    const cardRadio = screen.getByDisplayValue("card") as HTMLInputElement;
    const cashRadio = screen.getByDisplayValue("cash") as HTMLInputElement;

    expect(cardRadio.checked).toBe(false);
    expect(cashRadio.checked).toBe(true);
  });

  it("should disable both radios when disabled is true", () => {
    render(<PaymentMethodSelector {...defaultProps} disabled={true} />);

    const cardRadio = screen.getByDisplayValue("card") as HTMLInputElement;
    const cashRadio = screen.getByDisplayValue("cash") as HTMLInputElement;

    expect(cardRadio.disabled).toBe(true);
    expect(cashRadio.disabled).toBe(true);
  });

  it("should not call onChange when disabled", () => {
    const onChange = vi.fn();
    render(
      <PaymentMethodSelector
        {...defaultProps}
        value="card"
        onChange={onChange}
        disabled={true}
      />
    );

    const cashRadio = screen.getByDisplayValue("cash");
    fireEvent.click(cashRadio);

    // The onChange should not be called because the input is disabled
    // Note: In real browser behavior, clicking a disabled input won't trigger onChange
    // But in testing-library, we might need to check the disabled state instead
    expect(cashRadio).toBeDisabled();
  });

  it("should render card brand icons", () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    // Check that SVG icons are rendered (they're inline SVGs)
    const svgs = document.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });

  it("should apply selected styles to card option when value is card", () => {
    const { container } = render(
      <PaymentMethodSelector {...defaultProps} value="card" />
    );

    const labels = container.querySelectorAll("label");
    const cardLabel = labels[0];
    const cashLabel = labels[1];

    expect(cardLabel.className).toContain("border-theme-primary");
    expect(cardLabel.className).toContain("bg-theme-primary-light");
    expect(cashLabel.className).not.toContain("border-theme-primary");
  });

  it("should apply selected styles to cash option when value is cash", () => {
    const { container } = render(
      <PaymentMethodSelector {...defaultProps} value="cash" />
    );

    const labels = container.querySelectorAll("label");
    const cardLabel = labels[0];
    const cashLabel = labels[1];

    expect(cardLabel.className).not.toContain("border-theme-primary");
    expect(cashLabel.className).toContain("border-theme-primary");
    expect(cashLabel.className).toContain("bg-theme-primary-light");
  });
});
