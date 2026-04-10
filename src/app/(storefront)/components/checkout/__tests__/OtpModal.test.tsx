import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { OtpModal } from "../OtpModal";

describe("OtpModal", () => {
  const defaultProps = {
    isOpen: true,
    phone: "(555) 123-4567",
    onClose: vi.fn(),
    onVerify: vi.fn().mockResolvedValue(undefined),
    onResend: vi.fn().mockResolvedValue(undefined),
    isVerifying: false,
    error: undefined as string | undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return null when not open", () => {
    const { container } = render(<OtpModal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("should render modal when open", () => {
    render(<OtpModal {...defaultProps} />);
    expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
    expect(screen.getByText(/Code sent to/)).toBeInTheDocument();
  });

  it("should render 6 digit inputs", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByLabelText(/Digit/);
    expect(inputs).toHaveLength(6);
  });

  it("should display error message", () => {
    render(<OtpModal {...defaultProps} error="Invalid code" />);
    expect(screen.getByText("Invalid code")).toBeInTheDocument();
  });

  it("should show countdown timer initially", () => {
    render(<OtpModal {...defaultProps} />);
    expect(screen.getByText(/Resend code in 60s/)).toBeInTheDocument();
  });

  it("should show resend button after countdown expires", () => {
    render(<OtpModal {...defaultProps} />);
    act(() => {
      vi.advanceTimersByTime(61000);
    });
    expect(screen.getByText("Resend code")).toBeInTheDocument();
  });

  it("should call onClose when backdrop is clicked", () => {
    const { container } = render(<OtpModal {...defaultProps} />);
    const backdrop = container.querySelector(".bg-black\\/50");
    fireEvent.click(backdrop!);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should call onClose when close button is clicked", () => {
    render(<OtpModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should auto-submit when all 6 digits entered", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByLabelText(/Digit/);

    for (let i = 0; i < 6; i++) {
      fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
    }

    expect(defaultProps.onVerify).toHaveBeenCalledWith("123456");
  });

  it("should handle paste of 6-digit code", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByLabelText(/Digit/);

    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => "654321" },
    });

    expect(defaultProps.onVerify).toHaveBeenCalledWith("654321");
  });

  it("should disable submit button when code is incomplete", () => {
    render(<OtpModal {...defaultProps} />);
    expect(screen.getByText("Verify")).toBeDisabled();
  });

  it("should show Verifying... when isVerifying is true", () => {
    render(<OtpModal {...defaultProps} isVerifying={true} />);
    expect(screen.getByText("Verifying...")).toBeInTheDocument();
  });

  it("should disable inputs when verifying", () => {
    render(<OtpModal {...defaultProps} isVerifying={true} />);
    const inputs = screen.getAllByLabelText(/Digit/);
    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });

  it("should call onResend and reset countdown", async () => {
    render(<OtpModal {...defaultProps} />);

    act(() => {
      vi.advanceTimersByTime(61000);
    });

    const resendButton = screen.getByText("Resend code");
    await act(async () => {
      fireEvent.click(resendButton);
    });

    expect(defaultProps.onResend).toHaveBeenCalled();
    // After resend, countdown should restart
    expect(screen.getByText(/Resend code in 60s/)).toBeInTheDocument();
  });

  it("should handle backspace navigation to previous input", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByLabelText(/Digit/);

    fireEvent.change(inputs[0], { target: { value: "1" } });
    // Simulate backspace on empty second input
    fireEvent.keyDown(inputs[1], { key: "Backspace" });
    // No error thrown
  });

  it("should call handleSubmit via button when code is complete", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByLabelText(/Digit/);

    for (let i = 0; i < 6; i++) {
      fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
    }

    // Reset the mock after auto-submit
    defaultProps.onVerify.mockClear();

    // Click Verify button
    fireEvent.click(screen.getByText("Verify"));
    expect(defaultProps.onVerify).toHaveBeenCalledWith("123456");
  });

  it("should reset code when modal reopens", () => {
    const { rerender } = render(<OtpModal {...defaultProps} isOpen={false} />);
    rerender(<OtpModal {...defaultProps} isOpen={true} />);

    const inputs = screen.getAllByLabelText(/Digit/);
    inputs.forEach((input) => {
      expect(input).toHaveValue("");
    });
  });

  it("should strip non-digit characters from paste", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByLabelText(/Digit/);

    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => "12-34-56" },
    });

    expect(defaultProps.onVerify).toHaveBeenCalledWith("123456");
  });

  it("should show Sending... during resend", async () => {
    let resolveResend: () => void;
    defaultProps.onResend.mockImplementation(() => new Promise<void>((resolve) => { resolveResend = resolve; }));

    render(<OtpModal {...defaultProps} />);

    act(() => {
      vi.advanceTimersByTime(61000);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Resend code"));
    });

    expect(screen.getByText("Sending...")).toBeInTheDocument();

    await act(async () => {
      resolveResend!();
    });
  });

  it("should not submit incomplete code via Verify button", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByLabelText(/Digit/);

    // Enter only 3 digits
    fireEvent.change(inputs[0], { target: { value: "1" } });
    fireEvent.change(inputs[1], { target: { value: "2" } });
    fireEvent.change(inputs[2], { target: { value: "3" } });

    // Button should be disabled
    const verifyButton = screen.getByText("Verify");
    expect(verifyButton).toBeDisabled();

    // Click it anyway
    fireEvent.click(verifyButton);
    expect(defaultProps.onVerify).not.toHaveBeenCalled();
  });

  it("should not resend when canResend is false or already resending", () => {
    render(<OtpModal {...defaultProps} />);

    // Countdown is at 60, canResend is false
    // There's no resend button visible, only the countdown text
    expect(screen.getByText(/Resend code in 60s/)).toBeInTheDocument();
    expect(screen.queryByText("Resend code")).not.toBeInTheDocument();
  });

  it("should handle partial paste (less than 6 digits) without auto-submit", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByLabelText(/Digit/);

    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => "123" },
    });

    // Should fill first 3 inputs
    expect(inputs[0]).toHaveValue("1");
    expect(inputs[1]).toHaveValue("2");
    expect(inputs[2]).toHaveValue("3");
    expect(inputs[3]).toHaveValue("");

    // Should not auto-submit
    expect(defaultProps.onVerify).not.toHaveBeenCalled();
  });

  it("should handle empty paste gracefully", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByLabelText(/Digit/);

    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => "" },
    });

    // All inputs should remain empty
    inputs.forEach((input) => {
      expect(input).toHaveValue("");
    });
    expect(defaultProps.onVerify).not.toHaveBeenCalled();
  });

  it("should not auto-submit when entering digit on non-last input", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByLabelText(/Digit/);

    // Enter on index 3 (not the last)
    fireEvent.change(inputs[3], { target: { value: "5" } });

    expect(defaultProps.onVerify).not.toHaveBeenCalled();
  });

  it("should handle backspace on non-empty input without moving focus", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByLabelText(/Digit/);

    fireEvent.change(inputs[0], { target: { value: "1" } });
    fireEvent.change(inputs[1], { target: { value: "2" } });

    // Backspace on input with value - should not move to previous
    fireEvent.keyDown(inputs[1], { key: "Backspace" });
    // No crash, and input[1] still has value "2" (keyDown doesn't clear it)
    expect(inputs[1]).toHaveValue("2");
  });

  it("should handle backspace on first input gracefully", () => {
    render(<OtpModal {...defaultProps} />);
    const inputs = screen.getAllByLabelText(/Digit/);

    // Backspace on empty first input (index 0) should not crash
    fireEvent.keyDown(inputs[0], { key: "Backspace" });
    expect(inputs[0]).toHaveValue("");
  });

  it("should handle countdown reaching zero by enabling resend", () => {
    render(<OtpModal {...defaultProps} />);

    // Advance past countdown
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(screen.getByText("Resend code")).toBeInTheDocument();
    expect(screen.queryByText(/Resend code in/)).not.toBeInTheDocument();
  });
});
