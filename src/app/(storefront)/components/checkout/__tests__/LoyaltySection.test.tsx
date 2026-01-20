import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoyaltySection } from "../LoyaltySection";
import { MerchantProvider } from "@/contexts";

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
    }}
  >
    {children}
  </MerchantProvider>
);

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
    it("shows login prompt", () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );
      expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      expect(screen.getByText("rewards points")).toBeInTheDocument();
    });

    it("expands when clicked", () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      fireEvent.click(screen.getByText(/Sign in to earn/));

      expect(screen.getByText("Earn Rewards")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("(555) 123-4567")).toBeInTheDocument();
    });
  });

  describe("expanded state", () => {
    it("shows phone input and send code button", () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      fireEvent.click(screen.getByText(/Sign in to earn/));

      expect(screen.getByPlaceholderText("(555) 123-4567")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Send Code" })).toBeInTheDocument();
    });

    it("shows cancel button", () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      fireEvent.click(screen.getByText(/Sign in to earn/));
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("collapses when cancel clicked", () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByPlaceholderText("(555) 123-4567")).not.toBeInTheDocument();
    });

    it("disables send code button when phone is incomplete", () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      fireEvent.click(screen.getByText(/Sign in to earn/));

      const sendButton = screen.getByRole("button", { name: "Send Code" });
      expect(sendButton).toBeDisabled();

      // Enter partial phone
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123" },
      });
      expect(sendButton).toBeDisabled();
    });

    it("enables send code button when phone is complete", () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      fireEvent.click(screen.getByText(/Sign in to earn/));

      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });

      const sendButton = screen.getByRole("button", { name: "Send Code" });
      expect(sendButton).not.toBeDisabled();
    });

    it("shows estimated points", () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} subtotal={25.50} />
        </Wrapper>
      );

      fireEvent.click(screen.getByText(/Sign in to earn/));

      expect(screen.getByText(/\+25 pts/)).toBeInTheDocument();
    });
  });

  describe("OTP flow", () => {
    it("sends OTP and opens modal on success", async () => {
      mockFetch({ success: true });
      mockFetch({ success: true, data: { config: { pointsPerDollar: 1 } } });

      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send Code" }));

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

    it("shows error when OTP send fails", async () => {
      mockFetch({ success: false, error: "Phone number not found" });

      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send Code" }));

      await waitFor(() => {
        expect(screen.getByText("Phone number not found")).toBeInTheDocument();
      });
    });

    it("shows sending state on button", async () => {
      // Make fetch never resolve immediately
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () => new Promise(() => {})
      );

      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send Code" }));

      expect(screen.getByText("Sending...")).toBeInTheDocument();
    });
  });

  describe("verification flow", () => {
    const setupOtpModal = async () => {
      mockFetch({ success: true });
      mockFetch({ success: true, data: { config: { pointsPerDollar: 1 } } });

      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send Code" }));

      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });
    };

    it("verifies code and shows member card on success", async () => {
      await setupOtpModal();

      mockFetch({
        success: true,
        data: {
          member: {
            id: "member-1",
            phone: "+15551234567",
            name: "John Doe",
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
          name: "John Doe",
          points: 150,
        })
      );
    });

    it("shows error when verification fails", async () => {
      await setupOtpModal();

      mockFetch({ success: false, error: "Invalid code" });

      const inputs = screen.getAllByLabelText(/Digit \d/);
      for (let i = 0; i < 6; i++) {
        fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
      }

      await waitFor(() => {
        expect(screen.getByText("Invalid code")).toBeInTheDocument();
      });
    });
  });

  describe("logged in state", () => {
    const setupLoggedInState = async () => {
      mockFetch({ success: true });
      mockFetch({ success: true, data: { config: { pointsPerDollar: 2 } } });
      mockFetch({
        success: true,
        data: {
          member: {
            id: "member-1",
            phone: "+15551234567",
            name: "John Doe",
            points: 150,
          },
        },
      });

      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>
      );

      // Go through login flow
      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send Code" }));

      await waitFor(() => {
        expect(screen.getByText("Enter Verification Code")).toBeInTheDocument();
      });

      // Get OTP inputs by aria-label to avoid including the phone input
      const inputs = screen.getAllByLabelText(/Digit \d/);
      for (let i = 0; i < 6; i++) {
        fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
      }

      await waitFor(() => {
        expect(screen.getByText("Rewards Member")).toBeInTheDocument();
      });
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

      fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      expect(defaultProps.onMemberLogout).toHaveBeenCalled();
    });
  });
});
