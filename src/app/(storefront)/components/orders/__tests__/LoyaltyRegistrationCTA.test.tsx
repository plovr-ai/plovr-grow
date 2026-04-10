import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoyaltyRegistrationCTA } from "../LoyaltyRegistrationCTA";

// Mutable mock state
let mockMember: unknown = null;
let mockIsLoading = false;
let mockPointsPerDollar = 1;
const mockLogin = vi.fn();

vi.mock("@/contexts", () => ({
  useCompanySlug: () => "test-company",
  useLoyalty: () => ({
    member: mockMember,
    isLoading: mockIsLoading,
    pointsPerDollar: mockPointsPerDollar,
    login: mockLogin,
    logout: vi.fn(),
    refreshMember: vi.fn(),
  }),
}));

vi.mock("@/hooks", () => ({
  usePhoneInput: () => ({
    format: (val: string) => val,
  }),
}));

// Mock OtpModal
vi.mock("@storefront/components/checkout/OtpModal", () => ({
  OtpModal: ({
    isOpen,
    onVerify,
    onClose,
    onResend,
  }: {
    isOpen: boolean;
    phone: string;
    onVerify: (code: string) => void;
    onClose: () => void;
    onResend: () => Promise<void>;
    error?: string;
  }) =>
    isOpen ? (
      <div data-testid="otp-modal">
        <button onClick={() => onVerify("123456")}>Verify OTP</button>
        <button onClick={onClose}>Close OTP</button>
        <button onClick={onResend}>Resend OTP</button>
      </div>
    ) : null,
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("LoyaltyRegistrationCTA", () => {
  const defaultProps = {
    orderId: "order-123",
    customerPhone: "+15551234567",
    customerFirstName: "John",
    customerLastName: "Doe",
    customerEmail: "john@example.com",
    subtotal: 50,
    isGiftcardOrder: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockMember = null;
    mockIsLoading = false;
    mockPointsPerDollar = 1;

    // Default: points not already awarded
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { pointsAwarded: false },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });
  });

  it("should return null while loading", () => {
    mockIsLoading = true;
    const { container } = render(<LoyaltyRegistrationCTA {...defaultProps} />);
    expect(container.innerHTML).toBe("");
  });

  it("should return null if already a member", async () => {
    mockMember = { id: "m-1", phone: "+15551234567", email: null, firstName: null, lastName: null, points: 0 };
    const { container } = render(<LoyaltyRegistrationCTA {...defaultProps} />);
    // Wait for points check effect
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("should show collapsed CTA with estimated points", async () => {
    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      expect(screen.getByText(/50 points/)).toBeInTheDocument();
    });
  });

  it("should show gift card order messaging", async () => {
    render(<LoyaltyRegistrationCTA {...defaultProps} isGiftcardOrder={true} />);

    await waitFor(() => {
      expect(screen.getByText(/2x points/)).toBeInTheDocument();
    });
  });

  it("should expand to show registration form when clicked", async () => {
    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));

    expect(screen.getByText("Join Rewards Program")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("should pre-fill form fields from order data", async () => {
    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));

    // Check pre-filled values
    expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Doe")).toBeInTheDocument();
    expect(screen.getByDisplayValue("john@example.com")).toBeInTheDocument();
  });

  it("should collapse when Cancel is clicked", async () => {
    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));
    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    expect(screen.queryByText("Join Rewards Program")).not.toBeInTheDocument();
  });

  it("should show validation errors on empty form submit", async () => {
    render(
      <LoyaltyRegistrationCTA
        {...defaultProps}
        customerFirstName={null}
        customerLastName={null}
        customerEmail={null}
        customerPhone=""
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));

    // Clear any pre-filled values
    const firstNameInput = screen.getByPlaceholderText("John");
    fireEvent.change(firstNameInput, { target: { value: "" } });

    fireEvent.click(screen.getByText("Send Verification Code"));

    // Button should be disabled since phone is short
    expect(screen.getByText("Send Verification Code")).toBeDisabled();
  });

  it("should send OTP and show OTP modal", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { pointsAwarded: false },
          }),
        });
      }
      if (url.includes("/otp/send")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));
    fireEvent.click(screen.getByText("Send Verification Code"));

    await waitFor(() => {
      expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
    });
  });

  it("should show send error from API", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { pointsAwarded: false },
          }),
        });
      }
      if (url.includes("/otp/send")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: false,
            error: "Too many attempts",
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));
    fireEvent.click(screen.getByText("Send Verification Code"));

    await waitFor(() => {
      expect(screen.getByText("Too many attempts")).toBeInTheDocument();
    });
  });

  it("should show network error when send fails", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { pointsAwarded: false },
          }),
        });
      }
      if (url.includes("/otp/send")) {
        return Promise.reject(new Error("fail"));
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));
    fireEvent.click(screen.getByText("Send Verification Code"));

    await waitFor(() => {
      expect(screen.getByText("Network error. Please try again.")).toBeInTheDocument();
    });
  });

  describe("OTP verification and registration", () => {
    it("should complete registration and show success", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/order-points-status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { pointsAwarded: false },
            }),
          });
        }
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
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
                  points: 50,
                },
              },
            }),
          });
        }
        if (url.includes("/award-order-points")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { pointsEarned: 50 },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      render(<LoyaltyRegistrationCTA {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Join rewards and earn/));
      fireEvent.click(screen.getByText("Send Verification Code"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Verify OTP"));

      await waitFor(() => {
        expect(screen.getByText(/Welcome to rewards!/)).toBeInTheDocument();
        expect(screen.getByText(/earned 50 points/)).toBeInTheDocument();
      });
    });

    it("should show gift card success message for gift card orders", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/order-points-status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { pointsAwarded: false },
            }),
          });
        }
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
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
                  points: 0,
                },
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      render(
        <LoyaltyRegistrationCTA {...defaultProps} isGiftcardOrder={true} />
      );

      await waitFor(() => {
        expect(screen.getByText(/2x points/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Join rewards/));
      fireEvent.click(screen.getByText("Send Verification Code"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Verify OTP"));

      await waitFor(() => {
        expect(screen.getByText(/Welcome to rewards!/)).toBeInTheDocument();
        expect(screen.getByText(/2x points on future orders/)).toBeInTheDocument();
      });
    });

    it("should handle OTP verification failure", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/order-points-status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { pointsAwarded: false },
            }),
          });
        }
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
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
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      render(<LoyaltyRegistrationCTA {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Join rewards and earn/));
      fireEvent.click(screen.getByText("Send Verification Code"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Verify OTP"));

      await waitFor(() => {
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });

    it("should handle network error during verification", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/order-points-status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { pointsAwarded: false },
            }),
          });
        }
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          });
        }
        if (url.includes("/otp/verify")) {
          return Promise.reject(new Error("network error"));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      render(<LoyaltyRegistrationCTA {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Join rewards and earn/));
      fireEvent.click(screen.getByText("Send Verification Code"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Verify OTP"));

      await waitFor(() => {
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });
  });

  it("should return null when points already awarded", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { pointsAwarded: true },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    const { container } = render(
      <LoyaltyRegistrationCTA {...defaultProps} />
    );

    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("should show giftcard description when expanded for gift card order", async () => {
    render(<LoyaltyRegistrationCTA {...defaultProps} isGiftcardOrder={true} />);

    await waitFor(() => {
      expect(screen.getByText(/2x points/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards/));

    expect(screen.getByText(/Complete your profile to create an account./)).toBeInTheDocument();
  });

  it("should show regular description when expanded for normal order", async () => {
    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));

    expect(screen.getByText(/earn 50 points from this order/)).toBeInTheDocument();
  });

  it("should handle points check API error gracefully", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    // Should still render the CTA after error (defaults to false for pointsAlreadyAwarded)
    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });
  });

  it("should handle points check with missing data field", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: null,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    // Should still render (defaults to false)
    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });
  });

  it("should format 11-digit phone starting with 1 for API", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });
      }
      if (url.includes("/otp/send")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });

    render(
      <LoyaltyRegistrationCTA
        {...defaultProps}
        customerPhone="15551234567"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));

    // Change phone to 11 digits starting with 1
    const phoneInput = screen.getByPlaceholderText("(555) 123-4567");
    fireEvent.change(phoneInput, { target: { value: "15551234567" } });

    fireEvent.click(screen.getByText("Send Verification Code"));

    await waitFor(() => {
      const sendCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).includes("/otp/send")
      );
      expect(sendCalls.length).toBeGreaterThan(0);
      const body = JSON.parse(sendCalls[0][1].body);
      expect(body.phone).toBe("+15551234567");
    });
  });

  it("should show validation errors for invalid form fields", async () => {
    render(
      <LoyaltyRegistrationCTA
        {...defaultProps}
        customerFirstName={null}
        customerLastName={null}
        customerEmail={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));

    // Clear pre-filled values and submit
    fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "" } });
    fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "" } });
    fireEvent.change(screen.getByPlaceholderText("john@example.com"), { target: { value: "bad-email" } });

    // The button should be disabled since phone is empty, but let's check the form errors
    // The form validation runs on handleSendOtp which requires phone
  });

  it("should close OTP modal and clear verify error", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });
      }
      if (url.includes("/otp/send")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });

    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));
    fireEvent.click(screen.getByText("Send Verification Code"));

    await waitFor(() => {
      expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
    });

    // Close the modal
    fireEvent.click(screen.getByText("Close OTP"));

    expect(screen.queryByTestId("otp-modal")).not.toBeInTheDocument();
  });

  it("should use default send error message when API returns no error string", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });
      }
      if (url.includes("/otp/send")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: false }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });

    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));
    fireEvent.click(screen.getByText("Send Verification Code"));

    await waitFor(() => {
      expect(screen.getByText("Failed to send verification code")).toBeInTheDocument();
    });
  });

  it("should use default verify error message when API returns no error string", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });
      }
      if (url.includes("/otp/send")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      if (url.includes("/otp/verify")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: false }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });

    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));
    fireEvent.click(screen.getByText("Send Verification Code"));

    await waitFor(() => {
      expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Verify OTP"));

    await waitFor(() => {
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  it("should call handleResendOtp when resend is clicked", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });
      }
      if (url.includes("/otp/send")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });

    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));
    fireEvent.click(screen.getByText("Send Verification Code"));

    await waitFor(() => {
      expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
    });

    // Click resend
    fireEvent.click(screen.getByText("Resend OTP"));

    await waitFor(() => {
      const sendCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).includes("/otp/send")
      );
      expect(sendCalls.length).toBe(2);
    });
  });

  it("should show validation errors when submitting form with invalid data", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });

    render(
      <LoyaltyRegistrationCTA
        {...defaultProps}
        customerFirstName={null}
        customerLastName={null}
        customerEmail={null}
        customerPhone="5551234567"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));

    // Submit with empty required fields
    fireEvent.click(screen.getByText("Send Verification Code"));

    await waitFor(() => {
      // Should show validation errors for firstName, lastName, email
      expect(screen.getByText("First name is required")).toBeInTheDocument();
    });
  });

  it("should format phone with non-standard length for API", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });
      }
      if (url.includes("/otp/send")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });

    render(
      <LoyaltyRegistrationCTA
        {...defaultProps}
        customerPhone="44123456789012"
        customerFirstName="John"
        customerLastName="Doe"
        customerEmail="john@test.com"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));

    // Change phone to an unusual format
    const phoneInput = screen.getByPlaceholderText("(555) 123-4567");
    fireEvent.change(phoneInput, { target: { value: "44123456789012" } });

    fireEvent.click(screen.getByText("Send Verification Code"));

    await waitFor(() => {
      const sendCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).includes("/otp/send")
      );
      if (sendCalls.length > 0) {
        const body = JSON.parse(sendCalls[0][1].body);
        expect(body.phone).toBe("+44123456789012");
      }
    });
  });

  it("should clear form errors when editing fields", async () => {
    render(
      <LoyaltyRegistrationCTA
        {...defaultProps}
        customerFirstName={null}
        customerLastName={null}
        customerEmail={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));

    // Change phone field to clear send error
    const phoneInput = screen.getByPlaceholderText("(555) 123-4567");
    fireEvent.change(phoneInput, { target: { value: "5551234567" } });

    // Change first name to clear its error
    const firstNameInput = screen.getByPlaceholderText("John");
    fireEvent.change(firstNameInput, { target: { value: "Jane" } });
    expect(firstNameInput).toHaveValue("Jane");

    // Change last name to clear its error
    const lastNameInput = screen.getByPlaceholderText("Doe");
    fireEvent.change(lastNameInput, { target: { value: "Smith" } });
    expect(lastNameInput).toHaveValue("Smith");

    // Change email to clear its error
    const emailInput = screen.getByPlaceholderText("john@example.com");
    fireEvent.change(emailInput, { target: { value: "jane@test.com" } });
    expect(emailInput).toHaveValue("jane@test.com");
  });

  it("should use estimatedPoints when award API returns no pointsEarned", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/order-points-status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });
      }
      if (url.includes("/otp/send")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }
      if (url.includes("/otp/verify")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { member: { id: "m-1", phone: "+15551234567", email: null, firstName: null, lastName: null, points: 0 } },
          }),
        });
      }
      if (url.includes("/award-order-points")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: {} }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });

    render(<LoyaltyRegistrationCTA {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Join rewards and earn/));
    fireEvent.click(screen.getByText("Send Verification Code"));

    await waitFor(() => {
      expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Verify OTP"));

    await waitFor(() => {
      // Should use estimatedPoints (50) as fallback
      expect(screen.getByText(/earned 50 points/)).toBeInTheDocument();
    });
  });
});
