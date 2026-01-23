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
  customerName: "John Doe",
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
              member: { id: "member-1", phone: "+15551234567", name: "John", points: 100 },
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

    it("should pre-fill phone from order", async () => {
      render(<LoyaltyRegistrationCTA {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      // Phone should be pre-filled (format may vary based on locale)
      const phoneInput = screen.getByPlaceholderText("(555) 123-4567") as HTMLInputElement;
      // Just check that it has some value (phone was pre-filled)
      expect(phoneInput.value).toBeTruthy();
      // And contains the digits from the original phone
      expect(phoneInput.value.replace(/\D/g, "")).toContain("555123456");
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

    it("should disable verify button when phone is invalid", async () => {
      render(<LoyaltyRegistrationCTA {...defaultProps} customerPhone="" />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText(/Join rewards and earn/));

      const verifyButton = screen.getByRole("button", { name: "Verify" });
      expect(verifyButton).toBeDisabled();
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

    it("should call OTP send API when Verify is clicked", async () => {
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

      // Click Verify
      const verifyButton = screen.getByRole("button", { name: "Verify" });
      fireEvent.click(verifyButton);

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

      // Click Verify
      fireEvent.click(screen.getByRole("button", { name: "Verify" }));

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

      // Click Verify
      fireEvent.click(screen.getByRole("button", { name: "Verify" }));

      // Should show OTP modal
      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });
    });
  });

  describe("email integration", () => {
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

    it("should pass email to OTP verify API when customerEmail is provided", async () => {
      const propsWithEmail = {
        ...defaultProps,
        customerEmail: "john@example.com",
      };

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
            member: { id: "member-1", phone: "+15551234567", name: "John", points: 0 },
          },
        }),
      });

      // Mock award points
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { pointsEarned: 50 } }),
      });

      render(<LoyaltyRegistrationCTA {...propsWithEmail} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand and send OTP
      fireEvent.click(screen.getByText(/Join rewards and earn/));
      fireEvent.click(screen.getByRole("button", { name: "Verify" }));

      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });

      // Enter OTP code
      const otpInputs = screen.getAllByRole("textbox");
      otpInputs.forEach((input, i) => {
        fireEvent.change(input, { target: { value: String(i + 1) } });
      });

      // Verify button click - get all buttons and select the one in the modal
      const verifyButtons = screen.getAllByRole("button");
      const verifyCodeButton = verifyButtons.find(
        (btn) => btn.textContent?.includes("Verify Code") || btn.textContent?.includes("Verifying")
      );
      fireEvent.click(verifyCodeButton!);

      // Check API call includes email
      await waitFor(() => {
        const verifyCall = mockFetch.mock.calls.find(
          (call) => call[0] === "/api/storefront/loyalty/otp/verify"
        );
        expect(verifyCall).toBeDefined();
        const body = JSON.parse(verifyCall![1].body);
        expect(body.email).toBe("john@example.com");
        expect(body.name).toBe("John Doe");
        expect(body.companySlug).toBe("test-company");
      });
    });

    it("should handle null customerEmail gracefully", async () => {
      const propsWithoutEmail = {
        ...defaultProps,
        customerEmail: null,
      };

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
            member: { id: "member-1", phone: "+15551234567", name: "John", points: 0 },
          },
        }),
      });

      // Mock award points
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { pointsEarned: 50 } }),
      });

      render(<LoyaltyRegistrationCTA {...propsWithoutEmail} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });

      // Expand and complete flow
      fireEvent.click(screen.getByText(/Join rewards and earn/));
      fireEvent.click(screen.getByRole("button", { name: "Verify" }));

      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });

      // Enter OTP
      const otpInputs = screen.getAllByRole("textbox");
      otpInputs.forEach((input, i) => {
        fireEvent.change(input, { target: { value: String(i + 1) } });
      });
      const verifyButtons = screen.getAllByRole("button");
      const verifyCodeButton = verifyButtons.find(
        (btn) => btn.textContent?.includes("Verify Code") || btn.textContent?.includes("Verifying")
      );
      fireEvent.click(verifyCodeButton!);

      // Check API call - email should be null
      await waitFor(() => {
        const verifyCall = mockFetch.mock.calls.find(
          (call) => call[0] === "/api/storefront/loyalty/otp/verify"
        );
        expect(verifyCall).toBeDefined();
        const body = JSON.parse(verifyCall![1].body);
        expect(body.email).toBeNull();
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
            member: { id: "member-1", phone: "+15551234567", name: "John", points: 0 },
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
      fireEvent.click(screen.getByRole("button", { name: "Verify" }));

      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });

      const otpInputs = screen.getAllByRole("textbox");
      otpInputs.forEach((input, i) => {
        fireEvent.change(input, { target: { value: String(i + 1) } });
      });
      const verifyButtons = screen.getAllByRole("button");
      const verifyCodeButton = verifyButtons.find(
        (btn) => btn.textContent?.includes("Verify Code") || btn.textContent?.includes("Verifying")
      );
      fireEvent.click(verifyCodeButton!);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/Welcome to rewards/)).toBeInTheDocument();
        expect(screen.getByText(/50 points/)).toBeInTheDocument();
      });
    });
  });
});
