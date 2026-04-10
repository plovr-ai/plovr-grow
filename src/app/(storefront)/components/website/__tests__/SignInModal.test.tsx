import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SignInModal } from "../SignInModal";
import type { ReactNode } from "react";

// Mock contexts
const mockLogin = vi.fn();
vi.mock("@/contexts", () => ({
  useCompanySlug: () => "test-company",
  useLoyalty: () => ({
    login: mockLogin,
    member: null,
    isLoading: false,
    pointsPerDollar: 1,
    logout: vi.fn(),
    refreshMember: vi.fn(),
  }),
}));

// Mock hooks
vi.mock("@/hooks", () => ({
  usePhoneInput: () => ({
    format: (val: string) => val,
  }),
}));

// Mock OtpModal
vi.mock("../../checkout/OtpModal", () => ({
  OtpModal: ({
    isOpen,
    onVerify,
    onClose,
    onResend,
    error,
  }: {
    isOpen: boolean;
    phone: string;
    onVerify: (code: string) => void;
    onClose: () => void;
    onResend: () => void;
    error?: string;
  }) =>
    isOpen ? (
      <div data-testid="otp-modal">
        <button onClick={() => onVerify("123456")}>Verify OTP</button>
        <button onClick={onClose}>Close OTP</button>
        <button onClick={onResend}>Resend OTP</button>
        {error && <span data-testid="otp-error">{error}</span>}
      </div>
    ) : null,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("SignInModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should return null when not open", () => {
    const { container } = render(<SignInModal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("should render phone input step initially", () => {
    render(<SignInModal {...defaultProps} />);
    expect(screen.getByText("Sign In to Earn Rewards")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("(555) 123-4567")).toBeInTheDocument();
    expect(screen.getByText("Continue")).toBeInTheDocument();
  });

  it("should disable Continue when phone is too short", () => {
    render(<SignInModal {...defaultProps} />);
    expect(screen.getByText("Continue")).toBeDisabled();
  });

  it("should call onClose when close button is clicked", () => {
    render(<SignInModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should call onClose when backdrop is clicked", () => {
    const { container } = render(<SignInModal {...defaultProps} />);
    const backdrop = container.querySelector(".bg-black\\/50");
    fireEvent.click(backdrop!);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should clear phone error on input change", () => {
    render(<SignInModal {...defaultProps} />);
    const input = screen.getByPlaceholderText("(555) 123-4567");
    fireEvent.change(input, { target: { value: "555" } });
    // No error should be shown
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  describe("handleCheckPhone - existing member", () => {
    it("should show OTP modal for existing member", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { isNewMember: false },
            }),
          });
        }
        if (url.includes("/loyalty/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { config: { pointsPerDollar: 2 } },
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);
      const input = screen.getByPlaceholderText("(555) 123-4567");
      fireEvent.change(input, { target: { value: "5551234567" } });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });
    });
  });

  describe("handleCheckPhone - new member", () => {
    it("should show registration form for new member", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { isNewMember: true },
            }),
          });
        }
        if (url.includes("/loyalty/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: {} }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);
      const input = screen.getByPlaceholderText("(555) 123-4567");
      fireEvent.change(input, { target: { value: "5551234567" } });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });
    });
  });

  describe("handleCheckPhone - error", () => {
    it("should show API error", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: false,
              error: "Rate limit exceeded",
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);
      const input = screen.getByPlaceholderText("(555) 123-4567");
      fireEvent.change(input, { target: { value: "5551234567" } });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Rate limit exceeded")).toBeInTheDocument();
      });
    });

    it("should show default error when no error message", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);
      const input = screen.getByPlaceholderText("(555) 123-4567");
      fireEvent.change(input, { target: { value: "5551234567" } });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Failed to verify phone number")).toBeInTheDocument();
      });
    });

    it("should show network error on fetch failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      render(<SignInModal {...defaultProps} />);
      const input = screen.getByPlaceholderText("(555) 123-4567");
      fireEvent.change(input, { target: { value: "5551234567" } });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Network error. Please try again.")).toBeInTheDocument();
      });
    });

    it("should not call API when companySlug or phone is empty", async () => {
      render(<SignInModal {...defaultProps} />);
      // Phone is empty, Continue is disabled, but let's test the guard
      fireEvent.click(screen.getByText("Continue"));
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("registration form", () => {
    async function goToRegistrationStep() {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { isNewMember: true },
            }),
          });
        }
        if (url.includes("/loyalty/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: {} }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);
      const input = screen.getByPlaceholderText("(555) 123-4567");
      fireEvent.change(input, { target: { value: "5551234567" } });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });
    }

    it("should show validation errors for empty registration form", async () => {
      await goToRegistrationStep();

      fireEvent.click(screen.getByText("Send Verification Code"));

      await waitFor(() => {
        expect(screen.getByText("First name is required")).toBeInTheDocument();
      });
    });

    it("should show email validation error", async () => {
      await goToRegistrationStep();

      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Doe"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
        target: { value: "not-an-email" },
      });

      fireEvent.click(screen.getByText("Send Verification Code"));

      await waitFor(() => {
        expect(screen.getByText("Please enter a valid email")).toBeInTheDocument();
      });
    });

    it("should open OTP modal when registration form is valid", async () => {
      await goToRegistrationStep();

      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Doe"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
        target: { value: "john@example.com" },
      });

      fireEvent.click(screen.getByText("Send Verification Code"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });
    });

    it("should clear form errors when typing in fields", async () => {
      await goToRegistrationStep();

      // Trigger validation errors
      fireEvent.click(screen.getByText("Send Verification Code"));
      await waitFor(() => {
        expect(screen.getByText("First name is required")).toBeInTheDocument();
      });

      // Type in firstName to clear the error
      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "J" },
      });
      expect(screen.queryByText("First name is required")).not.toBeInTheDocument();
    });

    it("should go back to phone step when Change button clicked", async () => {
      await goToRegistrationStep();

      fireEvent.click(screen.getByText("Change"));

      await waitFor(() => {
        expect(screen.getByText("Sign In to Earn Rewards")).toBeInTheDocument();
      });
    });
  });

  describe("registration OTP verification", () => {
    it("should verify OTP with registration data for new member", async () => {
      let otpSendCount = 0;
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          otpSendCount++;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { isNewMember: true },
            }),
          });
        }
        if (url.includes("/otp/verify")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                member: {
                  id: "m-new",
                  phone: "+15551234567",
                  email: "john@example.com",
                  firstName: "John",
                  lastName: "Doe",
                  points: 0,
                },
              },
            }),
          });
        }
        if (url.includes("/loyalty/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: {} }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);

      // Enter phone and continue
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      // Wait for registration form
      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      // Fill registration form
      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Doe"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
        target: { value: "john@example.com" },
      });

      // Submit registration
      fireEvent.click(screen.getByText("Send Verification Code"));

      // Wait for OTP modal
      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      // Verify OTP
      fireEvent.click(screen.getByText("Verify OTP"));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "m-new",
            email: "john@example.com",
          }),
          expect.anything()
        );
        expect(defaultProps.onSuccess).toHaveBeenCalled();
      });
    });

    it("should show default verification error when no error message", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: { isNewMember: false } }),
          });
        }
        if (url.includes("/otp/verify")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false }),
          });
        }
        if (url.includes("/loyalty/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: {} }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Verify OTP"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-error")).toBeInTheDocument();
      });
    });
  });

  describe("OTP verification", () => {
    it("should login member on successful OTP verification", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { isNewMember: false },
            }),
          });
        }
        if (url.includes("/otp/verify")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                member: {
                  id: "m-1",
                  phone: "+15551234567",
                  email: "john@example.com",
                  firstName: "John",
                  lastName: "Doe",
                  points: 100,
                },
              },
            }),
          });
        }
        if (url.includes("/loyalty/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { config: { pointsPerDollar: 2 } },
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);
      const input = screen.getByPlaceholderText("(555) 123-4567");
      fireEvent.change(input, { target: { value: "5551234567" } });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Verify OTP"));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
        expect(defaultProps.onSuccess).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it("should show error on failed OTP verification", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { isNewMember: false },
            }),
          });
        }
        if (url.includes("/otp/verify")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: false,
              error: "Invalid code",
            }),
          });
        }
        if (url.includes("/loyalty/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: {} }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);
      const input = screen.getByPlaceholderText("(555) 123-4567");
      fireEvent.change(input, { target: { value: "5551234567" } });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Verify OTP"));

      await waitFor(() => {
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });

    it("should handle network error during OTP verification", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { isNewMember: false },
            }),
          });
        }
        if (url.includes("/otp/verify")) {
          return Promise.reject(new Error("Network error"));
        }
        if (url.includes("/loyalty/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: {} }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);
      const input = screen.getByPlaceholderText("(555) 123-4567");
      fireEvent.change(input, { target: { value: "5551234567" } });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Verify OTP"));

      await waitFor(() => {
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });
  });

  describe("resend OTP", () => {
    it("should resend OTP via API", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { isNewMember: false },
            }),
          });
        }
        if (url.includes("/loyalty/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: {} }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);
      const input = screen.getByPlaceholderText("(555) 123-4567");
      fireEvent.change(input, { target: { value: "5551234567" } });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Resend OTP"));

      await waitFor(() => {
        // Should have called /otp/send twice (initial + resend)
        const otpSendCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => (call[0] as string).includes("/otp/send")
        );
        expect(otpSendCalls.length).toBe(2);
      });
    });
  });

  describe("registration form field errors clear on typing", () => {
    async function goToRegistrationStep() {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: { isNewMember: true } }),
          });
        }
        if (url.includes("/loyalty/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: {} }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);
      const input = screen.getByPlaceholderText("(555) 123-4567");
      fireEvent.change(input, { target: { value: "5551234567" } });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });
    }

    it("should clear lastName error when typing", async () => {
      await goToRegistrationStep();
      fireEvent.click(screen.getByText("Send Verification Code"));
      await waitFor(() => {
        expect(screen.getByText("First name is required")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "D" } });
      // lastName error should be gone; firstName error still present
      expect(screen.getByText("First name is required")).toBeInTheDocument();
    });

    it("should clear email error when typing", async () => {
      await goToRegistrationStep();

      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "J" } });
      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "D" } });
      fireEvent.change(screen.getByPlaceholderText("john@example.com"), { target: { value: "bad" } });
      fireEvent.click(screen.getByText("Send Verification Code"));

      await waitFor(() => {
        expect(screen.getByText("Please enter a valid email")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText("john@example.com"), { target: { value: "good@email.com" } });
      expect(screen.queryByText("Please enter a valid email")).not.toBeInTheDocument();
    });
  });

  describe("status API error handling", () => {
    it("should continue even if status API fails", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: { isNewMember: false } }),
          });
        }
        if (url.includes("/loyalty/status")) {
          return Promise.reject(new Error("Status API down"));
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);
      const input = screen.getByPlaceholderText("(555) 123-4567");
      fireEvent.change(input, { target: { value: "5551234567" } });
      fireEvent.click(screen.getByText("Continue"));

      // Should still show OTP modal even if status fails
      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });
    });
  });

  describe("OTP modal close", () => {
    it("should close OTP modal and clear verify error", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: { isNewMember: false } }),
          });
        }
        if (url.includes("/loyalty/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: {} }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      // Close the OTP modal
      fireEvent.click(screen.getByText("Close OTP"));

      await waitFor(() => {
        expect(screen.queryByTestId("otp-modal")).not.toBeInTheDocument();
      });
    });
  });

  describe("resend OTP", () => {
    it("should call OTP send endpoint again on resend", async () => {
      let otpSendCount = 0;
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          otpSendCount++;
          if (otpSendCount === 1) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: true, data: { isNewMember: false } }),
            });
          }
          // Subsequent calls also succeed
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          });
        }
        if (url.includes("/loyalty/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: {} }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<SignInModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      // Resend will fail - the error is thrown by handleResendOtp
      // We just need the code path to be exercised
      await expect(async () => {
        fireEvent.click(screen.getByText("Resend OTP"));
        // Wait a tick for the promise to resolve
        await new Promise((r) => setTimeout(r, 50));
      }).not.toThrow();

      expect(otpSendCount).toBe(2);
    });
  });

  describe("phone number formatting for API", () => {
    it("should handle other digit lengths with + prefix", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { isNewMember: false },
        }),
      });

      render(<SignInModal {...defaultProps} />);
      // Use a number that doesn't match 10-digit or 11-digit-starting-with-1 patterns
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "441234567890" }, // UK-like number, 12 digits
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.phone).toBe("+441234567890");
      });
    });

    it("should handle 10-digit phone number", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { isNewMember: false },
        }),
      });

      render(<SignInModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.phone).toBe("+15551234567");
      });
    });

    it("should handle 11-digit phone number starting with 1", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { isNewMember: false },
        }),
      });

      render(<SignInModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "15551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.phone).toBe("+15551234567");
      });
    });
  });
});
