import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoyaltySection } from "../LoyaltySection";
import { MerchantProvider, LoyaltyProvider } from "@/contexts";

// Mock fetch
global.fetch = vi.fn();

const mockFetch = (response: object, ok = true) => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    json: () => Promise.resolve(response),
  });
};

const Wrapper = ({ children, companySlug = "test-company" }: { children: React.ReactNode; companySlug?: string | null }) => (
  <MerchantProvider
    config={{
      name: "Test Merchant",
      logoUrl: null,
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
      companySlug,
      tenantId: companySlug ? "test-company-id" : null,
    }}
  >
    <LoyaltyProvider>{children}</LoyaltyProvider>
  </MerchantProvider>
);

// Helper to mock initial /me API call for not-logged-in state
const mockInitialNotLoggedIn = () => {
  mockFetch({ success: false, error: "Not logged in" });
};

describe("LoyaltySection", () => {
  const defaultProps = {
    subtotal: 25.00,
    onMemberLogin: vi.fn(),
    onMemberLogout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockReset();
  });

  describe("when companySlug is null", () => {
    it("renders nothing", () => {
      const { container } = render(
        <Wrapper companySlug={null}>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe("collapsed state", () => {
    beforeEach(() => {
      mockInitialNotLoggedIn();
    });

    it("shows login prompt", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );
      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });
      expect(screen.getByText("rewards points")).toBeInTheDocument();
    });

    it("expands when clicked", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Sign in to earn/));

      expect(screen.getByText("Earn Rewards")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("(555) 123-4567")).toBeInTheDocument();
    });
  });

  describe("phone input step", () => {
    beforeEach(() => {
      mockInitialNotLoggedIn();
    });

    it("shows phone input and continue button", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Sign in to earn/));

      expect(screen.getByPlaceholderText("(555) 123-4567")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    });

    it("shows cancel button", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Sign in to earn/));
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("collapses when cancel clicked", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByPlaceholderText("(555) 123-4567")).not.toBeInTheDocument();
    });

    it("disables continue button when phone is incomplete", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Sign in to earn/));

      const continueButton = screen.getByRole("button", { name: "Continue" });
      expect(continueButton).toBeDisabled();

      // Enter partial phone
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123" },
      });
      expect(continueButton).toBeDisabled();
    });

    it("enables continue button when phone is complete", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Sign in to earn/));

      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });

      const continueButton = screen.getByRole("button", { name: "Continue" });
      expect(continueButton).not.toBeDisabled();
    });

    it("shows estimated points", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} subtotal={25.50} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Sign in to earn/));

      expect(screen.getByText(/\+25 pts/)).toBeInTheDocument();
    });
  });

  describe("existing member flow", () => {
    beforeEach(() => {
      mockInitialNotLoggedIn();
    });

    it("opens OTP modal directly for existing members", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      // API returns isNewMember: false for existing member
      mockFetch({ success: true, data: { isNewMember: false } });
      mockFetch({ success: true, data: { config: { pointsPerDollar: 1 } } });

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/storefront/loyalty/otp/send",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("+15551234567"),
        })
      );
    });

    it("shows error when phone check fails", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      mockFetch({ success: false, error: "Phone number not found" });

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(screen.getByText("Phone number not found")).toBeInTheDocument();
      });
    });

    it("shows checking state on button", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      // Make fetch never resolve immediately
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () => new Promise(() => {})
      );

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      expect(screen.getByText("Checking...")).toBeInTheDocument();
    });
  });

  describe("new member registration flow", () => {
    beforeEach(() => {
      mockInitialNotLoggedIn();
    });

    it("shows registration form for new members", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      // API returns isNewMember: true for new member
      mockFetch({ success: true, data: { isNewMember: true } });
      mockFetch({ success: true, data: { config: { pointsPerDollar: 1 } } });

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      // Registration form should have required fields
      expect(screen.getByPlaceholderText("John")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Doe")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("john@example.com")).toBeInTheDocument();
    });

    it("shows phone number as read-only in registration form", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      mockFetch({ success: true, data: { isNewMember: true } });
      mockFetch({ success: true, data: { config: { pointsPerDollar: 1 } } });

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      // Phone should be displayed but not editable
      expect(screen.getByText("(555) 123-4567")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
    });

    it("allows going back to phone input from registration form", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      mockFetch({ success: true, data: { isNewMember: true } });
      mockFetch({ success: true, data: { config: { pointsPerDollar: 1 } } });

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      // Click Change to go back
      fireEvent.click(screen.getByRole("button", { name: "Change" }));

      // Should be back to phone input
      expect(screen.getByText("Earn Rewards")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("(555) 123-4567")).toBeInTheDocument();
    });

    it("validates required fields before showing OTP modal", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      mockFetch({ success: true, data: { isNewMember: true } });
      mockFetch({ success: true, data: { config: { pointsPerDollar: 1 } } });

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      // Try to submit without filling in fields
      fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText("First name is required")).toBeInTheDocument();
        expect(screen.getByText("Last name is required")).toBeInTheDocument();
      });
    });

    it("validates email format", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      mockFetch({ success: true, data: { isNewMember: true } });
      mockFetch({ success: true, data: { config: { pointsPerDollar: 1 } } });

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      // Fill in names but invalid email
      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Doe"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
        target: { value: "invalid-email" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

      await waitFor(() => {
        expect(screen.getByText("Please enter a valid email")).toBeInTheDocument();
      });
    });

    it("shows OTP modal after valid registration form submission", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      mockFetch({ success: true, data: { isNewMember: true } });
      mockFetch({ success: true, data: { config: { pointsPerDollar: 1 } } });

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      // Fill in all required fields
      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Doe"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
        target: { value: "john@example.com" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });
    });
  });

  describe("verification flow", () => {
    beforeEach(() => {
      mockInitialNotLoggedIn();
    });

    const setupOtpModalForExistingMember = async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      mockFetch({ success: true, data: { isNewMember: false } });
      mockFetch({ success: true, data: { config: { pointsPerDollar: 1 } } });

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });
    };

    it("verifies code and shows member card on success", async () => {
      await setupOtpModalForExistingMember();

      mockFetch({
        success: true,
        data: {
          member: {
            id: "member-1",
            phone: "+15551234567",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            points: 150,
          },
        },
      });

      // Enter OTP code - get inputs by aria-label to avoid phone input
      const inputs = screen.getAllByLabelText(/Digit \d/);
      for (let i = 0; i < 6; i++) {
        fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
      }

      await waitFor(() => {
        expect(screen.getByText("Rewards Member")).toBeInTheDocument();
      });

      expect(screen.getByText("150 pts")).toBeInTheDocument();
      expect(defaultProps.onMemberLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "member-1",
          phone: "+15551234567",
          points: 150,
        })
      );
    });

    it("shows error when verification fails", async () => {
      await setupOtpModalForExistingMember();

      mockFetch({ success: false, error: "Invalid code" });

      const inputs = screen.getAllByLabelText(/Digit \d/);
      // Wrap in act() so React flushes the state update that triggers
      // the async onVerify callback on the 6th digit.
      await act(async () => {
        for (let i = 0; i < 6; i++) {
          fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
        }
      });

      await waitFor(() => {
        expect(screen.getByText("Invalid code")).toBeInTheDocument();
      });
    });

    it("sends registration data when verifying new member", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      mockFetch({ success: true, data: { isNewMember: true } });
      mockFetch({ success: true, data: { config: { pointsPerDollar: 1 } } });

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      // Fill in registration form
      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Doe"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
        target: { value: "john@example.com" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });

      mockFetch({
        success: true,
        data: {
          member: {
            id: "member-1",
            phone: "+15551234567",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            points: 0,
          },
        },
      });

      // Enter OTP
      const inputs = screen.getAllByLabelText(/Digit \d/);
      for (let i = 0; i < 6; i++) {
        fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
      }

      await waitFor(() => {
        expect(screen.getByText("Rewards Member")).toBeInTheDocument();
      });

      // Check that registration data was sent
      const verifyCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "/api/storefront/loyalty/otp/verify"
      );
      expect(verifyCall).toBeDefined();
      const body = JSON.parse(verifyCall![1].body);
      expect(body.firstName).toBe("John");
      expect(body.lastName).toBe("Doe");
      expect(body.email).toBe("john@example.com");
    });
  });

  describe("logged in state", () => {
    beforeEach(() => {
      mockInitialNotLoggedIn();
    });

    const setupLoggedInState = async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      mockFetch({ success: true, data: { isNewMember: false } });
      mockFetch({ success: true, data: { config: { pointsPerDollar: 2 } } });

      // Go through login flow — wrap in act to flush all state updates
      await act(async () => {
        fireEvent.click(screen.getByText(/Sign in to earn/));
      });
      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
          target: { value: "(555) 123-4567" },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      });

      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });

      mockFetch({
        success: true,
        data: {
          member: {
            id: "member-1",
            phone: "+15551234567",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            points: 150,
          },
        },
      });

      // Get OTP inputs by aria-label to avoid including the phone input
      const inputs = screen.getAllByLabelText(/Digit \d/);
      for (let i = 0; i < 6; i++) {
        await act(async () => {
          fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
        });
      }

      await waitFor(
        () => {
          expect(screen.getByText("Rewards Member")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    };

    it("shows member card with points", async () => {
      await setupLoggedInState();

      expect(screen.getByText("Current Points")).toBeInTheDocument();
      expect(screen.getByText("150 pts")).toBeInTheDocument();
    });

    it("shows estimated points to earn", async () => {
      await setupLoggedInState();

      // With pointsPerDollar = 2 and subtotal = 25, estimated = 50
      expect(screen.getByText("+50 pts")).toBeInTheDocument();
    });

    it("shows sign out button", async () => {
      await setupLoggedInState();

      expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    });

    it("signs out when sign out clicked", async () => {
      await setupLoggedInState();

      // Mock the logout API call
      mockFetch({ success: true });

      fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      expect(defaultProps.onMemberLogout).toHaveBeenCalled();
    });
  });
});
