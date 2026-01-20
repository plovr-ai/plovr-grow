import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OtpModal } from "../OtpModal";

describe("OtpModal", () => {
  const defaultProps = {
    isOpen: true,
    phone: "(555) 123-4567",
    onClose: vi.fn(),
    onVerify: vi.fn(),
    onResend: vi.fn(),
    isVerifying: false,
    error: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    render(<OtpModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("Enter Verification Code")).not.toBeInTheDocument();
  });

  it("renders modal when open", () => {
    render(<OtpModal {...defaultProps} />);
    expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
    expect(screen.getByText("Code sent to (555) 123-4567")).toBeInTheDocument();
  });

  it("renders 6 input fields", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(6);
  });

  it("handles digit input and auto-focuses next field", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByRole("textbox");

    fireEvent.change(inputs[0], { target: { value: "1" } });
    expect(inputs[0]).toHaveValue("1");
    expect(document.activeElement).toBe(inputs[1]);
  });

  it("only allows numeric input", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByRole("textbox");

    fireEvent.change(inputs[0], { target: { value: "a" } });
    expect(inputs[0]).toHaveValue("");
  });

  it("handles backspace to previous field", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByRole("textbox");

    // First enter a digit in first field, then move to second
    fireEvent.change(inputs[0], { target: { value: "1" } });

    // Now backspace on empty second field should go back to first
    fireEvent.keyDown(inputs[1], { key: "Backspace" });
    expect(document.activeElement).toBe(inputs[0]);
  });

  it("auto-submits when all 6 digits entered", async () => {
    const onVerify = vi.fn();
    render(<OtpModal {...defaultProps} onVerify={onVerify} />);
    const inputs = screen.getAllByRole("textbox");

    // Enter first 5 digits
    for (let i = 0; i < 5; i++) {
      fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
    }

    // Enter last digit - should trigger submit
    fireEvent.change(inputs[5], { target: { value: "6" } });

    expect(onVerify).toHaveBeenCalledWith("123456");
  });

  it("handles paste of full code", () => {
    const onVerify = vi.fn();
    render(<OtpModal {...defaultProps} onVerify={onVerify} />);
    const inputs = screen.getAllByRole("textbox");

    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => "123456" },
    });

    expect(onVerify).toHaveBeenCalledWith("123456");
  });

  it("shows countdown timer", () => {
    render(<OtpModal {...defaultProps} />);
    expect(screen.getByText(/Resend code in \d+s/)).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(<OtpModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop clicked", () => {
    const onClose = vi.fn();
    render(<OtpModal {...defaultProps} onClose={onClose} />);

    // Click on backdrop
    fireEvent.click(screen.getByText("Enter Verification Code").closest(".fixed")!.querySelector(".bg-black\\/50")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error message when provided", () => {
    render(<OtpModal {...defaultProps} error="Invalid code" />);
    expect(screen.getByText("Invalid code")).toBeInTheDocument();
  });

  it("disables inputs when verifying", () => {
    render(<OtpModal {...defaultProps} isVerifying={true} />);
    const inputs = screen.getAllByRole("textbox");

    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });

  it("shows verifying state on submit button", () => {
    render(<OtpModal {...defaultProps} isVerifying={true} />);
    expect(screen.getByText("Verifying...")).toBeInTheDocument();
  });

  it("disables verify button when code incomplete", () => {
    render(<OtpModal {...defaultProps} />);
    const verifyButton = screen.getByRole("button", { name: "Verify" });
    expect(verifyButton).toBeDisabled();
  });

  it("enables verify button when code complete", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByRole("textbox");

    for (let i = 0; i < 6; i++) {
      fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
    }

    const verifyButton = screen.getByRole("button", { name: "Verify" });
    expect(verifyButton).not.toBeDisabled();
  });

  it("calls onVerify when verify button clicked with complete code", () => {
    const onVerify = vi.fn();
    render(<OtpModal {...defaultProps} onVerify={onVerify} />);
    const inputs = screen.getAllByRole("textbox");

    // Reset the mock after auto-submit
    for (let i = 0; i < 6; i++) {
      fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
    }
    onVerify.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(onVerify).toHaveBeenCalledWith("123456");
  });
});
