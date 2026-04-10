import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeliveryAddressForm } from "../DeliveryAddressForm";

describe("DeliveryAddressForm", () => {
  const defaultValues = {
    street: "",
    apt: "",
    city: "",
    state: "",
    zipCode: "",
    instructions: "",
  };

  const defaultProps = {
    values: defaultValues,
    errors: {},
    onChange: vi.fn(),
    disabled: false,
  };

  it("should render all form fields", () => {
    render(<DeliveryAddressForm {...defaultProps} />);
    expect(screen.getByText("Delivery Address")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("123 Main St")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Apt 4B")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("New York")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("10001")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Gate code, building entrance, etc.")).toBeInTheDocument();
  });

  it("should call onChange when fields are changed", () => {
    render(<DeliveryAddressForm {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText("123 Main St"), { target: { value: "456 Oak Ave" } });
    expect(defaultProps.onChange).toHaveBeenCalledWith("street", "456 Oak Ave");
  });

  it("should display errors for each field", () => {
    const errors = {
      street: "Street is required",
      city: "City is required",
      state: "State is required",
      zipCode: "ZIP code is required",
    };
    render(<DeliveryAddressForm {...defaultProps} errors={errors} />);
    expect(screen.getByText("Street is required")).toBeInTheDocument();
    expect(screen.getByText("City is required")).toBeInTheDocument();
    expect(screen.getByText("State is required")).toBeInTheDocument();
    expect(screen.getByText("ZIP code is required")).toBeInTheDocument();
  });

  it("should disable all inputs when disabled", () => {
    render(<DeliveryAddressForm {...defaultProps} disabled={true} />);
    expect(screen.getByPlaceholderText("123 Main St")).toBeDisabled();
    expect(screen.getByPlaceholderText("Apt 4B")).toBeDisabled();
    expect(screen.getByPlaceholderText("New York")).toBeDisabled();
    expect(screen.getByPlaceholderText("10001")).toBeDisabled();
  });

  it("should render US states in the state dropdown", () => {
    render(<DeliveryAddressForm {...defaultProps} />);
    const select = screen.getByLabelText(/State/);
    expect(select).toBeInTheDocument();
    // Check that Select option exists
    expect(screen.getByText("Select")).toBeInTheDocument();
  });

  it("should call onChange for apt field", () => {
    render(<DeliveryAddressForm {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText("Apt 4B"), { target: { value: "Suite 200" } });
    expect(defaultProps.onChange).toHaveBeenCalledWith("apt", "Suite 200");
  });

  it("should call onChange for instructions field", () => {
    render(<DeliveryAddressForm {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText("Gate code, building entrance, etc."), {
      target: { value: "Ring doorbell" },
    });
    expect(defaultProps.onChange).toHaveBeenCalledWith("instructions", "Ring doorbell");
  });

  it("should call onChange for city field", () => {
    render(<DeliveryAddressForm {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText("New York"), {
      target: { value: "Los Angeles" },
    });
    expect(defaultProps.onChange).toHaveBeenCalledWith("city", "Los Angeles");
  });

  it("should call onChange for state field", () => {
    render(<DeliveryAddressForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/State/), {
      target: { value: "CA" },
    });
    expect(defaultProps.onChange).toHaveBeenCalledWith("state", "CA");
  });

  it("should call onChange for zipCode field", () => {
    render(<DeliveryAddressForm {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText("10001"), {
      target: { value: "90210" },
    });
    expect(defaultProps.onChange).toHaveBeenCalledWith("zipCode", "90210");
  });

  it("should display apt error", () => {
    const errors = { apt: "Invalid apartment" };
    render(<DeliveryAddressForm {...defaultProps} errors={errors} />);
    expect(screen.getByText("Invalid apartment")).toBeInTheDocument();
    const aptInput = screen.getByPlaceholderText("Apt 4B");
    expect(aptInput.className).toContain("border-red-500");
  });

  it("should display instructions error", () => {
    const errors = { instructions: "Instructions too long" };
    render(<DeliveryAddressForm {...defaultProps} errors={errors} />);
    expect(screen.getByText("Instructions too long")).toBeInTheDocument();
    const instructionsInput = screen.getByPlaceholderText("Gate code, building entrance, etc.");
    expect(instructionsInput.className).toContain("border-red-500");
  });

  it("should display pre-filled values", () => {
    render(
      <DeliveryAddressForm
        {...defaultProps}
        values={{
          street: "123 Main St",
          apt: "Apt 4B",
          city: "New York",
          state: "NY",
          zipCode: "10001",
          instructions: "Leave at door",
        }}
      />
    );
    expect(screen.getByDisplayValue("123 Main St")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Apt 4B")).toBeInTheDocument();
    expect(screen.getByDisplayValue("New York")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10001")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Leave at door")).toBeInTheDocument();
  });
});
