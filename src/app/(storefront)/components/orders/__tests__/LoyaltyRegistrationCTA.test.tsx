import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoyaltyRegistrationCTA } from "../LoyaltyRegistrationCTA";
import { MerchantProvider, LoyaltyProvider } from "@/contexts";
import type { ReactNode } from "react";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider
        config={{
          name: "Test Restaurant",
          logoUrl: null,
          currency: "USD",
          locale: "en-US",
          timezone: "America/New_York",
          companyId: "test-company-id",
          companySlug: "test-company",
        }}
      >
        <LoyaltyProvider>{children}</LoyaltyProvider>
      </MerchantProvider>
    );
  };
}

const defaultProps = {
  orderId: "order-123",
  customerPhone: "+15551234567",
  customerFirstName: "John",
  customerLastName: "Doe",
  customerEmail: "john@example.com",
  subtotal: 50.0,
};

describe("LoyaltyRegistrationCTA", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("visibility conditions", () => {
    it("should not render while checking points status", () => {
      // Mock loyalty /me API (not logged in) - keep pending to simulate loading
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { container } = render(
        <LoyaltyRegistrationCTA {...defaultProps} />,
        { wrapper: createWrapper() }
      );

      // Component should not render anything while loading
      expect(container.firstChild).toBeNull();
    });

    it("should not render if already a loyalty member", async () => {
      // Mock loyalty /me API (logged in)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              member: { id: "member-1", phone: "+15551234567", firstName: "John", lastName: null, points: 100 },
              pointsPerDollar: 1,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });

      const { container } = render(
        <LoyaltyRegistrationCTA {...defaultProps} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        // Component should not render when user is already a member
        expect(container.firstChild).toBeNull();
      });
    });

    it("should not render if points already awarded", async () => {
      // Mock loyalty /me API (not logged in)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false, error: "Not logged in" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: true } }),
        });

      const { container } = render(
        <LoyaltyRegistrationCTA {...defaultProps} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });

    it("should render CTA when not a member and points not awarded", async () => {
      // Mock loyalty /me API (not logged in) and points status (not awarded)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false, error: "Not logged in" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });

      render(<LoyaltyRegistrationCTA {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });
    });
  });

  describe("collapsed state", () => {
    beforeEach(() => {
      // Default mocks for non-member, points not awarded
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false, error: "Not logged in" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });
    });

    it("should display points message in the CTA", async () => {
      render(<LoyaltyRegistrationCTA {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      // Wait for component to render (after loading states complete)
      await waitFor(() => {
        // Check that the CTA is visible with points message
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Check that "points" text is somewhere in the CTA
      const ctaButton = screen.getByRole("button");
      expect(ctaButton.textContent).toContain("points");
      expect(ctaButton.textContent).toContain("for this order");
    });

    it("should expand when clicked", async () => {
      render(<LoyaltyRegistrationCTA {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Click to expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      // Should show expanded content
      expect(screen.getByText("Join Rewards Program")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });
  });

  describe("expanded state", () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false, error: "Not logged in" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });
    });

    it("should pre-fill all fields from order", async () => {
      render(<LoyaltyRegistrationCTA {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      // All fields should be pre-filled
      const phoneInput = screen.getByPlaceholderText("(555) 123-4567") as HTMLInputElement;
      expect(phoneInput.value).toBeTruthy();

      const firstNameInput = screen.getByPlaceholderText("John") as HTMLInputElement;
      expect(firstNameInput.value).toBe("John");

      const lastNameInput = screen.getByPlaceholderText("Doe") as HTMLInputElement;
      expect(lastNameInput.value).toBe("Doe");

      const emailInput = screen.getByPlaceholderText("john@example.com") as HTMLInputElement;
      expect(emailInput.value).toBe("john@example.com");
    });

    it("should show required indicators on all fields", async () => {
      render(<LoyaltyRegistrationCTA {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      // Check for required field labels
      expect(screen.getByText(/Phone Number/)).toBeInTheDocument();
      expect(screen.getByText(/First Name/)).toBeInTheDocument();
      expect(screen.getByText(/Last Name/)).toBeInTheDocument();
      expect(screen.getByText(/Email/)).toBeInTheDocument();
    });

    it("should collapse when Cancel is clicked", async () => {
      render(<LoyaltyRegistrationCTA {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));
      expect(screen.getByText("Join Rewards Program")).toBeInTheDocument();

      // Click Cancel
      fireEvent.click(screen.getByText("Cancel"));

      // Should be collapsed again
      expect(screen.queryByText("Join Rewards Program")).not.toBeInTheDocument();
    });

    it("should disable send button when phone is invalid", async () => {
      render(<LoyaltyRegistrationCTA {...defaultProps} customerPhone="" />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      const sendButton = screen.getByRole("button", { name: "Send Verification Code" });
      expect(sendButton).toBeDisabled();
    });

    it("should allow editing pre-filled fields", async () => {
      render(<LoyaltyRegistrationCTA {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      // Edit firstName
      const firstNameInput = screen.getByPlaceholderText("John") as HTMLInputElement;
      fireEvent.change(firstNameInput, { target: { value: "Jane" } });
      expect(firstNameInput.value).toBe("Jane");

      // Edit lastName
      const lastNameInput = screen.getByPlaceholderText("Doe") as HTMLInputElement;
      fireEvent.change(lastNameInput, { target: { value: "Smith" } });
      expect(lastNameInput.value).toBe("Smith");

      // Edit email
      const emailInput = screen.getByPlaceholderText("john@example.com") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "jane@example.com" } });
      expect(emailInput.value).toBe("jane@example.com");
    });
  });

  describe("form validation", () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false, error: "Not logged in" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });
    });

    it("should validate required fields before sending OTP", async () => {
      render(
        <LoyaltyRegistrationCTA
          {...defaultProps}
          customerFirstName={null}
          customerLastName={null}
          customerEmail={null}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      // Try to send without filling required fields
      fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText("First name is required")).toBeInTheDocument();
        expect(screen.getByText("Last name is required")).toBeInTheDocument();
      });
    });

    it("should validate email format", async () => {
      render(
        <LoyaltyRegistrationCTA
          {...defaultProps}
          customerEmail="invalid-email"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      // Try to send with invalid email
      fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

      // Should show email validation error
      await waitFor(() => {
        expect(screen.getByText("Please enter a valid email")).toBeInTheDocument();
      });
    });

    it("should clear validation errors when field is corrected", async () => {
      render(
        <LoyaltyRegistrationCTA
          {...defaultProps}
          customerFirstName={null}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      // Submit to trigger validation error
      fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

      await waitFor(() => {
        expect(screen.getByText("First name is required")).toBeInTheDocument();
      });

      // Fix the error
      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "John" } });

      // Error should be cleared
      expect(screen.queryByText("First name is required")).not.toBeInTheDocument();
    });
  });

  describe("OTP flow", () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false, error: "Not logged in" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });
    });

    it("should call OTP send API when Send Verification Code is clicked", async () => {
      // Additional mock for OTP send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<LoyaltyRegistrationCTA {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      // Click Send Verification Code
      const sendButton = screen.getByRole("button", { name: "Send Verification Code" });
      fireEvent.click(sendButton);

      // Should have called OTP send API
      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const otpCall = calls.find(
          (call) => call[0] === "/api/storefront/loyalty/otp/send"
        );
        expect(otpCall).toBeDefined();
      });
    });

    it("should show error when OTP send fails", async () => {
      // Mock failed OTP send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: "Phone number invalid" }),
      });

      render(<LoyaltyRegistrationCTA {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      // Click Send Verification Code
      fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

      // Should show error
      await waitFor(() => {
        expect(screen.getByText("Phone number invalid")).toBeInTheDocument();
      });
    });

    it("should open OTP modal after successful OTP send", async () => {
      // Mock successful OTP send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<LoyaltyRegistrationCTA {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      // Click Send Verification Code
      fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

      // Should show OTP modal
      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });
    });
  });

  describe("registration completion", () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false, error: "Not logged in" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });
    });

    it("should pass edited form data to OTP verify API", async () => {
      // Mock OTP send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Mock OTP verify
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            member: { id: "member-1", phone: "+15551234567", firstName: "Jane", lastName: "Smith", email: "jane@example.com", points: 0 },
          },
        }),
      });

      // Mock award points
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { pointsEarned: 50 } }),
      });

      render(<LoyaltyRegistrationCTA {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand and edit fields
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "Jane" } });
      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Smith" } });
      fireEvent.change(screen.getByPlaceholderText("john@example.com"), { target: { value: "jane@example.com" } });

      fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });

      // Enter OTP code - use aria-label to select only OTP digit inputs
      const otpInputs = screen.getAllByLabelText(/Digit \d/);
      for (let i = 0; i < 6; i++) {
        fireEvent.change(otpInputs[i], { target: { value: String(i + 1) } });
      }

      // Check API call includes edited data
      await waitFor(() => {
        const verifyCall = mockFetch.mock.calls.find(
          (call) => call[0] === "/api/storefront/loyalty/otp/verify"
        );
        expect(verifyCall).toBeDefined();
        const body = JSON.parse(verifyCall![1].body);
        expect(body.firstName).toBe("Jane");
        expect(body.lastName).toBe("Smith");
        expect(body.email).toBe("jane@example.com");
        expect(body.companySlug).toBe("test-company");
      });
    });

    it("should display success message after registration with points earned", async () => {
      // Mock OTP send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Mock OTP verify
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            member: { id: "member-1", phone: "+15551234567", firstName: "John", lastName: "Doe", email: "john@example.com", points: 0 },
          },
        }),
      });

      // Mock award points
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { pointsEarned: 50 } }),
      });

      render(<LoyaltyRegistrationCTA {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Complete registration flow
      fireEvent.click(screen.getByText(/Join rewards and earn/));
      fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });

      const otpInputs = screen.getAllByLabelText(/Digit \d/);
      for (let i = 0; i < 6; i++) {
        fireEvent.change(otpInputs[i], { target: { value: String(i + 1) } });
      }

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/Welcome to rewards/)).toBeInTheDocument();
        expect(screen.getByText(/50 points/)).toBeInTheDocument();
      });
    });
  });

  describe("isGiftcardOrder prop", () => {
    beforeEach(() => {
      // Default mocks for non-member, points not awarded
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false, error: "Not logged in" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { pointsAwarded: false } }),
        });
    });

    it("should display 2x points message in collapsed state for gift card orders", async () => {
      render(<LoyaltyRegistrationCTA {...defaultProps} isGiftcardOrder={true} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      const ctaButton = screen.getByRole("button");
      expect(ctaButton.textContent).toContain("2x points");
      expect(ctaButton.textContent).toContain("when using gift cards");
      expect(ctaButton.textContent).not.toContain("for this order");
    });

    it("should display simplified description in expanded state for gift card orders", async () => {
      render(<LoyaltyRegistrationCTA {...defaultProps} isGiftcardOrder={true} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      // Should show simplified description without points
      expect(screen.getByText("Complete your profile to create an account.")).toBeInTheDocument();
    });

    it("should NOT call award-order-points API for gift card orders", async () => {
      // Mock OTP send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Mock OTP verify
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            member: { id: "member-1", phone: "+15551234567", email: null, firstName: "John", lastName: "Doe", points: 0 },
          },
        }),
      });

      render(<LoyaltyRegistrationCTA {...defaultProps} isGiftcardOrder={true} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand and send OTP
      fireEvent.click(screen.getByText(/Join rewards and earn/));
      fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });

      // Enter OTP code - use aria-label to select only OTP digit inputs
      const otpInputs = screen.getAllByLabelText(/Digit \d/);
      for (let i = 0; i < 6; i++) {
        fireEvent.change(otpInputs[i], { target: { value: String(i + 1) } });
      }

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText(/Welcome to rewards/)).toBeInTheDocument();
      });

      // Verify that award-order-points was NOT called
      const awardCall = mockFetch.mock.calls.find(
        (call) => call[0] === "/api/storefront/loyalty/award-order-points"
      );
      expect(awardCall).toBeUndefined();
    });

    it("should show gift card specific success message after registration", async () => {
      // Mock OTP send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Mock OTP verify
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            member: { id: "member-1", phone: "+15551234567", email: null, firstName: "John", lastName: "Doe", points: 0 },
          },
        }),
      });

      render(<LoyaltyRegistrationCTA {...defaultProps} isGiftcardOrder={true} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Complete registration flow
      fireEvent.click(screen.getByText(/Join rewards and earn/));
      fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });

      const otpInputs = screen.getAllByLabelText(/Digit \d/);
      for (let i = 0; i < 6; i++) {
        fireEvent.change(otpInputs[i], { target: { value: String(i + 1) } });
      }

      // Should show gift card specific success message
      await waitFor(() => {
        expect(screen.getByText(/Welcome to rewards/)).toBeInTheDocument();
        expect(screen.getByText(/Use your gift cards to earn 2x points/)).toBeInTheDocument();
      });

      // Should NOT mention "points from this order"
      expect(screen.queryByText(/points from this order/)).not.toBeInTheDocument();
    });
  });
});
