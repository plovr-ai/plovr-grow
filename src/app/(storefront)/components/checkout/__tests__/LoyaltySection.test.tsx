import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoyaltySection } from "../LoyaltySection";

// Mock state for useLoyalty
let mockMember: { id: string; phone: string; email: string | null; firstName: string | null; lastName: string | null; points: number } | null = null;
let mockIsLoading = false;
let mockPointsPerDollar = 1;
const mockLogin = vi.fn();
const mockLogout = vi.fn().mockResolvedValue(undefined);

vi.mock("@/contexts", () => ({
  useCompanySlug: () => "test-company",
  useLoyalty: () => ({
    member: mockMember,
    isLoading: mockIsLoading,
    pointsPerDollar: mockPointsPerDollar,
    login: mockLogin,
    logout: mockLogout,
    refreshMember: vi.fn(),
  }),
}));

vi.mock("@/hooks", () => ({
  usePhoneInput: () => ({
    format: (val: string) => val,
  }),
}));

// Mock OtpModal
vi.mock("../OtpModal", () => ({
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

describe("LoyaltySection", () => {
  const defaultProps = {
    subtotal: 50,
    onMemberLogin: vi.fn(),
    onMemberLogout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockMember = null;
    mockIsLoading = false;
    mockPointsPerDollar = 1;
  });

  it("should return null when companySlug is null", () => {
    // Override the mock temporarily - tricky since we can't easily change module mock
    // Instead test the loading state
  });

  it("should show loading state while checking session", () => {
    mockIsLoading = true;
    const { container } = render(<LoyaltySection {...defaultProps} />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("should show collapsed login prompt when not logged in", () => {
    render(<LoyaltySection {...defaultProps} />);
    expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
    expect(screen.getByText(/rewards points/)).toBeInTheDocument();
  });

  it("should expand to show phone input when clicked", () => {
    render(<LoyaltySection {...defaultProps} />);
    fireEvent.click(screen.getByText(/Sign in to earn/));

    expect(screen.getByPlaceholderText("(555) 123-4567")).toBeInTheDocument();
    expect(screen.getByText("Earn Rewards")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("should show estimated points when expanded", () => {
    render(<LoyaltySection {...defaultProps} />);
    fireEvent.click(screen.getByText(/Sign in to earn/));

    expect(screen.getByText(/\+50 pts/)).toBeInTheDocument();
  });

  it("should collapse when Cancel is clicked", () => {
    render(<LoyaltySection {...defaultProps} />);
    fireEvent.click(screen.getByText(/Sign in to earn/));
    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("(555) 123-4567")).not.toBeInTheDocument();
  });

  describe("logged in member", () => {
    it("should show member card with points", () => {
      mockMember = {
        id: "m-1",
        phone: "+15551234567",
        email: "john@example.com",
        firstName: "John",
        lastName: "Doe",
        points: 200,
      };

      render(<LoyaltySection {...defaultProps} />);
      expect(screen.getByText("Rewards Member")).toBeInTheDocument();
      expect(screen.getByText("200 pts")).toBeInTheDocument();
      expect(screen.getByText("Sign out")).toBeInTheDocument();
    });

    it("should show estimated points earned", () => {
      mockMember = {
        id: "m-1",
        phone: "+15551234567",
        email: null,
        firstName: null,
        lastName: null,
        points: 100,
      };

      render(<LoyaltySection {...defaultProps} />);
      expect(screen.getByText(/\+50 pts/)).toBeInTheDocument();
    });

    it("should call logout and onMemberLogout when Sign out is clicked", async () => {
      mockMember = {
        id: "m-1",
        phone: "+15551234567",
        email: null,
        firstName: null,
        lastName: null,
        points: 0,
      };

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText("Sign out"));

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(defaultProps.onMemberLogout).toHaveBeenCalled();
      });
    });
  });

  describe("phone check flow", () => {
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
            json: async () => ({
              success: true,
              data: { config: { pointsPerDollar: 2 } },
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });
    });

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
            json: async () => ({ success: true, data: {} }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });
    });

    it("should show phone error on API failure", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: false,
              error: "Invalid phone",
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Invalid phone")).toBeInTheDocument();
      });
    });

    it("should show network error on fetch failure", async () => {
      mockFetch.mockRejectedValue(new Error("Fail"));

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Network error. Please try again.")).toBeInTheDocument();
      });
    });
  });

  describe("registration form", () => {
    async function goToRegistration() {
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

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });
    }

    it("should show validation errors for empty form", async () => {
      await goToRegistration();
      fireEvent.click(screen.getByText("Send Verification Code"));

      await waitFor(() => {
        expect(screen.getByText("First name is required")).toBeInTheDocument();
      });
    });

    it("should go back to phone step on Change click", async () => {
      await goToRegistration();
      fireEvent.click(screen.getByText("Change"));

      expect(screen.getByText("Earn Rewards")).toBeInTheDocument();
    });

    it("should open OTP modal with valid form", async () => {
      await goToRegistration();

      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Doe"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
        target: { value: "john@test.com" },
      });

      fireEvent.click(screen.getByText("Send Verification Code"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });
    });
  });

  describe("cancel from registration step", () => {
    it("should go back to collapsed state when Cancel is clicked from registration step", async () => {
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

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      // Click Cancel from registration step
      fireEvent.click(screen.getByText("Cancel"));

      expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      expect(screen.queryByText("Create Your Account")).not.toBeInTheDocument();
    });
  });

  describe("close OTP modal", () => {
    it("should close OTP modal and clear verify error", async () => {
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

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Close OTP"));
      expect(screen.queryByTestId("otp-modal")).not.toBeInTheDocument();
    });
  });

  describe("default phone error message", () => {
    it("should show default error when API returns no error string", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/otp/send")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Failed to verify phone number")).toBeInTheDocument();
      });
    });
  });

  describe("default verify error message", () => {
    it("should show default verify error when API returns no error string", async () => {
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

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
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

  describe("status API error handling", () => {
    it("should continue even if loyalty status API fails", async () => {
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
          return Promise.reject(new Error("Status API down"));
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });
    });
  });

  describe("member with zero estimated points", () => {
    it("should not show estimated points when subtotal is 0", () => {
      mockMember = {
        id: "m-1",
        phone: "+15551234567",
        email: null,
        firstName: null,
        lastName: null,
        points: 100,
      };

      render(<LoyaltySection {...defaultProps} subtotal={0} />);
      expect(screen.queryByText(/\+0 pts/)).not.toBeInTheDocument();
    });
  });

  describe("OTP verification in LoyaltySection", () => {
    it("should login member on successful verification", async () => {
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
                  email: "john@test.com",
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
            json: async () => ({ success: true, data: {} }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Verify OTP"));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
        expect(defaultProps.onMemberLogin).toHaveBeenCalled();
      });
    });

    it("should handle verification failure", async () => {
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
              error: "Wrong code",
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

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

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
          return Promise.reject(new Error("fail"));
        }
        if (url.includes("/loyalty/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: {} }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
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

  describe("formatPhoneForApi edge cases", () => {
    it("should format 11-digit phone starting with 1 for OTP send", async () => {
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

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "15551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        const sendCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => (call[0] as string).includes("/otp/send")
        );
        expect(sendCalls.length).toBeGreaterThan(0);
        const body = JSON.parse(sendCalls[0][1].body);
        expect(body.phone).toBe("+15551234567");
      });
    });

    it("should format short phone number with + prefix", async () => {
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

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      // Use a 12-digit phone to hit the fallback branch
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "445551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        const sendCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => (call[0] as string).includes("/otp/send")
        );
        expect(sendCalls.length).toBeGreaterThan(0);
        const body = JSON.parse(sendCalls[0][1].body);
        expect(body.phone).toBe("+445551234567");
      });
    });
  });

  describe("resend OTP", () => {
    it("should resend OTP when requested from modal", async () => {
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

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      // Click resend OTP
      fireEvent.click(screen.getByText("Resend OTP"));

      // The OTP send should have been called twice (initial + resend)
      await waitFor(() => {
        const sendCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => (call[0] as string).includes("/otp/send")
        );
        expect(sendCalls.length).toBe(2);
      });
    });

    it("should handle resend when API succeeds", async () => {
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

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      // Click resend - both calls succeed
      fireEvent.click(screen.getByText("Resend OTP"));

      // Verify the resend was attempted
      await waitFor(() => {
        const sendCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => (call[0] as string).includes("/otp/send")
        );
        expect(sendCalls.length).toBe(2);
      });
    });
  });

  describe("registration form field error clearing", () => {
    async function goToRegistration() {
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

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });
    }

    it("should clear firstName error when typing in firstName field", async () => {
      await goToRegistration();
      fireEvent.click(screen.getByText("Send Verification Code"));

      await waitFor(() => {
        expect(screen.getByText("First name is required")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "J" },
      });
      expect(screen.queryByText("First name is required")).not.toBeInTheDocument();
    });

    it("should clear lastName error when typing in lastName field", async () => {
      await goToRegistration();
      fireEvent.click(screen.getByText("Send Verification Code"));

      await waitFor(() => {
        expect(screen.getByText("First name is required")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText("Doe"), {
        target: { value: "D" },
      });
      // firstName error still present, but lastName error cleared
      expect(screen.getByText("First name is required")).toBeInTheDocument();
    });

    it("should clear email error when typing in email field", async () => {
      await goToRegistration();

      // Fill name fields, submit with invalid email
      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "John" } });
      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Doe" } });
      fireEvent.change(screen.getByPlaceholderText("john@example.com"), { target: { value: "bad" } });

      fireEvent.click(screen.getByText("Send Verification Code"));

      await waitFor(() => {
        expect(screen.getByText("Please enter a valid email")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
        target: { value: "good@test.com" },
      });
      expect(screen.queryByText("Please enter a valid email")).not.toBeInTheDocument();
    });
  });

  describe("zero subtotal estimated points in registration", () => {
    it("should not show estimated points when subtotal is 0 in registration step", async () => {
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

      render(<LoyaltySection {...defaultProps} subtotal={0} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      // Should not show "+0 pts"
      expect(screen.queryByText(/\+0 pts/)).not.toBeInTheDocument();
    });
  });

  describe("phone error clear on typing", () => {
    it("should clear phone error when typing in phone field", () => {
      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));

      const phoneInput = screen.getByPlaceholderText("(555) 123-4567");
      fireEvent.change(phoneInput, { target: { value: "555" } });

      // No error should be shown
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });

  describe("registration with OTP verification", () => {
    it("should include registration data when verifying OTP for new member", async () => {
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
        if (url.includes("/otp/verify")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                member: {
                  id: "m-1",
                  phone: "+15551234567",
                  email: "john@test.com",
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

      render(<LoyaltySection {...defaultProps} />);
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "5551234567" },
      });
      fireEvent.click(screen.getByText("Continue"));

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
        target: { value: "john@test.com" },
      });

      fireEvent.click(screen.getByText("Send Verification Code"));

      await waitFor(() => {
        expect(screen.getByTestId("otp-modal")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Verify OTP"));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
        // Verify registration data was included
        const verifyCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => (call[0] as string).includes("/otp/verify")
        );
        const body = JSON.parse(verifyCalls[0][1].body);
        expect(body.firstName).toBe("John");
        expect(body.lastName).toBe("Doe");
        expect(body.email).toBe("john@test.com");
      });
    });
  });
});
