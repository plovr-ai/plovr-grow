import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContactInfoForm } from "../ContactInfoForm";

vi.mock("@/hooks", () => ({
  usePhoneInput: () => ({
    format: (val: string) => {
      const digits = val.replace(/\D/g, "");
      if (digits.length >= 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
      }
      return val;
    },
  }),
}));

describe("ContactInfoForm", () => {
  const defaultProps = {
    values: {
      customerFirstName: "",
      customerLastName: "",
      customerPhone: "",
      customerEmail: "",
    },
    errors: {},
    onChange: vi.fn(),
    disabled: false,
  };

  it("should render all fields", () => {
    render(<ContactInfoForm {...defaultProps} />);
    expect(screen.getByPlaceholderText("John")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Doe")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("(555) 123-4567")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("your@email.com")).toBeInTheDocument();
  });

  it("should format phone input through usePhoneInput", () => {
    render(<ContactInfoForm {...defaultProps} />);
    const phoneInput = screen.getByPlaceholderText("(555) 123-4567");
    fireEvent.change(phoneInput, { target: { value: "5551234567" } });
    expect(defaultProps.onChange).toHaveBeenCalledWith("customerPhone", "(555) 123-4567");
  });

  it("should display all field errors", () => {
    const errors = {
      customerFirstName: "First name is required",
      customerLastName: "Last name is required",
      customerPhone: "Phone is required",
      customerEmail: "Invalid email",
    };
    render(<ContactInfoForm {...defaultProps} errors={errors} />);
    expect(screen.getByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    expect(screen.getByText("Phone is required")).toBeInTheDocument();
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
  });

  it("should disable all inputs when disabled", () => {
    render(<ContactInfoForm {...defaultProps} disabled={true} />);
    expect(screen.getByPlaceholderText("John")).toBeDisabled();
    expect(screen.getByPlaceholderText("Doe")).toBeDisabled();
    expect(screen.getByPlaceholderText("(555) 123-4567")).toBeDisabled();
    expect(screen.getByPlaceholderText("your@email.com")).toBeDisabled();
  });
});
