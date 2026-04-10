import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GiftCardInput } from "../GiftCardInput";
import type { AppliedGiftCard } from "../GiftCardInput";
import { MerchantProvider } from "@/contexts";
import type { ReactNode } from "react";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MerchantProvider
      config={{
        name: "Test Restaurant",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        companySlug: "test-company",      }}
    >
      {children}
    </MerchantProvider>
  );
}

describe("GiftCardInput", () => {
  const defaultProps = {
    totalAmount: 50,
    appliedGiftCard: null as AppliedGiftCard | null,
    onApply: vi.fn(),
    onRemove: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("unapplied state", () => {
    it("should render input and apply button", () => {
      render(<GiftCardInput {...defaultProps} />, { wrapper: Wrapper });
      expect(screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX")).toBeInTheDocument();
      expect(screen.getByText("Apply")).toBeInTheDocument();
      expect(screen.getByText("Gift Card")).toBeInTheDocument();
    });

    it("should show helper text", () => {
      render(<GiftCardInput {...defaultProps} />, { wrapper: Wrapper });
      expect(screen.getByText("Enter your gift card number to apply it to this order")).toBeInTheDocument();
    });

    it("should uppercase and clean input", () => {
      render(<GiftCardInput {...defaultProps} />, { wrapper: Wrapper });
      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
      fireEvent.change(input, { target: { value: "abcd-1234" } });
      expect(input).toHaveValue("ABCD-1234");
    });

    it("should strip non-alphanumeric/dash characters", () => {
      render(<GiftCardInput {...defaultProps} />, { wrapper: Wrapper });
      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
      fireEvent.change(input, { target: { value: "AB!@#CD" } });
      expect(input).toHaveValue("ABCD");
    });

    it("should disable apply button when input is empty", () => {
      render(<GiftCardInput {...defaultProps} />, { wrapper: Wrapper });
      expect(screen.getByText("Apply")).toBeDisabled();
    });

    it("should show error for empty submission", async () => {
      render(<GiftCardInput {...defaultProps} />, { wrapper: Wrapper });
      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
      // Type then clear
      fireEvent.change(input, { target: { value: "A" } });
      fireEvent.change(input, { target: { value: "" } });

      // Manually click apply (should be disabled, but let's test handleApply with empty)
      // The button is disabled, so we test the empty string path via Enter key
    });

    it("should call API and apply gift card on success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            giftCardId: "gc-123",
            balance: 30,
            cardNumber: "1234-5678-9012-3456",
          },
        }),
      });

      render(<GiftCardInput {...defaultProps} />, { wrapper: Wrapper });
      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
      fireEvent.change(input, { target: { value: "1234567890123456" } });
      fireEvent.click(screen.getByText("Apply"));

      await waitFor(() => {
        expect(defaultProps.onApply).toHaveBeenCalledWith({
          giftCardId: "gc-123",
          cardNumber: "1234-5678-9012-3456",
          availableBalance: 30,
          amountToApply: 30, // min(30, 50)
        });
      });
    });

    it("should cap amountToApply at totalAmount", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            giftCardId: "gc-123",
            balance: 100,
            cardNumber: "1234-5678-9012-3456",
          },
        }),
      });

      render(<GiftCardInput {...defaultProps} totalAmount={25} />, { wrapper: Wrapper });
      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
      fireEvent.change(input, { target: { value: "1234567890123456" } });
      fireEvent.click(screen.getByText("Apply"));

      await waitFor(() => {
        expect(defaultProps.onApply).toHaveBeenCalledWith(
          expect.objectContaining({
            amountToApply: 25,
          })
        );
      });
    });

    it("should show error on API failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: "Gift card not found",
        }),
      });

      render(<GiftCardInput {...defaultProps} />, { wrapper: Wrapper });
      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
      fireEvent.change(input, { target: { value: "INVALID-CARD" } });
      fireEvent.click(screen.getByText("Apply"));

      await waitFor(() => {
        expect(screen.getByText("Gift card not found")).toBeInTheDocument();
      });
    });

    it("should show error on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      render(<GiftCardInput {...defaultProps} />, { wrapper: Wrapper });
      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
      fireEvent.change(input, { target: { value: "1234567890123456" } });
      fireEvent.click(screen.getByText("Apply"));

      await waitFor(() => {
        expect(screen.getByText("Failed to validate gift card")).toBeInTheDocument();
      });
    });

    it("should show loading state during validation", async () => {
      let resolvePromise: (value: unknown) => void;
      mockFetch.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      render(<GiftCardInput {...defaultProps} />, { wrapper: Wrapper });
      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
      fireEvent.change(input, { target: { value: "1234567890123456" } });
      fireEvent.click(screen.getByText("Apply"));

      await waitFor(() => {
        expect(screen.getByText("Checking...")).toBeInTheDocument();
      });

      // Resolve to clean up
      resolvePromise!({
        ok: true,
        json: async () => ({ success: true, data: { giftCardId: "gc-1", balance: 10, cardNumber: "1234" } }),
      });
    });

    it("should apply gift card on Enter key", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            giftCardId: "gc-123",
            balance: 30,
            cardNumber: "1234-5678-9012-3456",
          },
        }),
      });

      render(<GiftCardInput {...defaultProps} />, { wrapper: Wrapper });
      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
      fireEvent.change(input, { target: { value: "1234567890123456" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(defaultProps.onApply).toHaveBeenCalled();
      });
    });

    it("should disable input and button when disabled prop is true", () => {
      render(<GiftCardInput {...defaultProps} disabled={true} />, { wrapper: Wrapper });
      expect(screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX")).toBeDisabled();
    });

    it("should show default error message when API returns no error string", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
        }),
      });

      render(<GiftCardInput {...defaultProps} />, { wrapper: Wrapper });
      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
      fireEvent.change(input, { target: { value: "INVALID" } });
      fireEvent.click(screen.getByText("Apply"));

      await waitFor(() => {
        expect(screen.getByText("Invalid gift card")).toBeInTheDocument();
      });
    });
  });

  describe("applied state", () => {
    const appliedGiftCard: AppliedGiftCard = {
      giftCardId: "gc-123",
      cardNumber: "1234-5678-9012-3456",
      availableBalance: 30,
      amountToApply: 30,
    };

    it("should show applied gift card info", () => {
      render(
        <GiftCardInput {...defaultProps} appliedGiftCard={appliedGiftCard} />,
        { wrapper: Wrapper }
      );
      expect(screen.getByText("1234-5678-9012-3456")).toBeInTheDocument();
      expect(screen.getByText("Remove")).toBeInTheDocument();
    });

    it("should show full balance message when using full balance", () => {
      render(
        <GiftCardInput {...defaultProps} appliedGiftCard={appliedGiftCard} />,
        { wrapper: Wrapper }
      );
      expect(screen.getByText(/Using full balance/)).toBeInTheDocument();
    });

    it("should show partial balance message when not using full balance", () => {
      const partialCard: AppliedGiftCard = {
        ...appliedGiftCard,
        availableBalance: 100,
        amountToApply: 50,
      };
      render(
        <GiftCardInput {...defaultProps} appliedGiftCard={partialCard} />,
        { wrapper: Wrapper }
      );
      expect(screen.getByText(/Using.*of.*balance/)).toBeInTheDocument();
    });

    it("should call onRemove when Remove is clicked", () => {
      render(
        <GiftCardInput {...defaultProps} appliedGiftCard={appliedGiftCard} />,
        { wrapper: Wrapper }
      );
      fireEvent.click(screen.getByText("Remove"));
      expect(defaultProps.onRemove).toHaveBeenCalled();
    });

    it("should disable Remove button when disabled", () => {
      render(
        <GiftCardInput {...defaultProps} appliedGiftCard={appliedGiftCard} disabled={true} />,
        { wrapper: Wrapper }
      );
      expect(screen.getByText("Remove")).toBeDisabled();
    });
  });

  describe("error for empty submission via handleApply", () => {
    it("should show error when submitting empty card number via Enter on empty", async () => {
      render(<GiftCardInput {...defaultProps} />, { wrapper: Wrapper });
      const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");

      // Type something then clear to test handleApply with empty
      fireEvent.change(input, { target: { value: "A" } });
      fireEvent.change(input, { target: { value: "" } });

      // Trigger Enter key (which calls handleApply with empty)
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByText("Please enter a gift card number")).toBeInTheDocument();
      });
    });
  });
});
