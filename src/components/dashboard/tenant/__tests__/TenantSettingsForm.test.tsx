import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TenantSettingsForm } from "../TenantSettingsForm";

// Mock next/navigation
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

// Mock server action
const mockUpdateCompanySettingsAction = vi.fn();

vi.mock("@/app/(dashboard)/dashboard/(protected)/tenant/actions", () => ({
  updateTenantSettingsAction: (input: unknown) =>
    mockUpdateCompanySettingsAction(input),
}));

describe("TenantSettingsForm", () => {
  const defaultProps = {
    currency: "USD",
    locale: "en-US",
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateCompanySettingsAction.mockResolvedValue({ success: true });
  });

  describe("Rendering", () => {
    it("should render the modal title", () => {
      render(<TenantSettingsForm {...defaultProps} />);

      expect(screen.getByText("Edit Regional Settings")).toBeInTheDocument();
    });

    it("should render currency select with current value", () => {
      render(<TenantSettingsForm {...defaultProps} />);

      const currencySelect = screen.getByLabelText("Currency") as HTMLSelectElement;
      expect(currencySelect.value).toBe("USD");
    });

    it("should render locale select with current value", () => {
      render(<TenantSettingsForm {...defaultProps} />);

      const localeSelect = screen.getByLabelText("Locale") as HTMLSelectElement;
      expect(localeSelect.value).toBe("en-US");
    });

    it("should render helper text for currency and locale", () => {
      render(<TenantSettingsForm {...defaultProps} />);

      expect(
        screen.getByText("Currency used for menu prices and orders")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Determines number and date formatting")
      ).toBeInTheDocument();
    });

    it("should render Cancel and Save buttons", () => {
      render(<TenantSettingsForm {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /save changes/i })
      ).toBeInTheDocument();
    });
  });

  describe("Close Behavior", () => {
    it("should call onClose when Cancel is clicked", () => {
      render(<TenantSettingsForm {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onClose when X button is clicked", () => {
      render(<TenantSettingsForm {...defaultProps} />);

      // Find the X close button in the header
      const buttons = screen.getAllByRole("button");
      const xButton = buttons.find((btn) =>
        btn.querySelector("svg.lucide-x")
      );
      fireEvent.click(xButton!);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onClose when clicking overlay", () => {
      render(<TenantSettingsForm {...defaultProps} />);

      // The overlay has aria-hidden="true"
      const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement;
      fireEvent.click(overlay);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe("Form Submission - Success", () => {
    it("should call updateTenantSettingsAction with selected values on submit", async () => {
      render(<TenantSettingsForm {...defaultProps} />);

      // Change currency
      const currencySelect = screen.getByLabelText("Currency");
      fireEvent.change(currencySelect, { target: { value: "EUR" } });

      // Change locale
      const localeSelect = screen.getByLabelText("Locale");
      fireEvent.change(localeSelect, { target: { value: "en-GB" } });

      // Submit
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdateCompanySettingsAction).toHaveBeenCalledWith({
          currency: "EUR",
          locale: "en-GB",
        });
      });
    });

    it("should call router.refresh and onClose on success", async () => {
      render(<TenantSettingsForm {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it("should show 'Saving...' while submitting", async () => {
      let resolveAction: (value: unknown) => void;
      mockUpdateCompanySettingsAction.mockReturnValue(
        new Promise((resolve) => {
          resolveAction = resolve;
        })
      );

      render(<TenantSettingsForm {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      expect(screen.getByText("Saving...")).toBeInTheDocument();

      resolveAction!({ success: true });

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });
  });

  describe("Form Submission - Error", () => {
    it("should display error message when action returns error", async () => {
      mockUpdateCompanySettingsAction.mockResolvedValue({
        success: false,
        error: "Permission denied",
      });

      render(<TenantSettingsForm {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText("Permission denied")).toBeInTheDocument();
      });

      // Should not close or refresh on error
      expect(defaultProps.onClose).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("should display generic error when action returns no error message", async () => {
      mockUpdateCompanySettingsAction.mockResolvedValue({
        success: false,
      });

      render(<TenantSettingsForm {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Failed to update settings")
        ).toBeInTheDocument();
      });
    });

    it("should clear error when resubmitting", async () => {
      mockUpdateCompanySettingsAction
        .mockResolvedValueOnce({ success: false, error: "Error occurred" })
        .mockResolvedValueOnce({ success: true });

      render(<TenantSettingsForm {...defaultProps} />);

      // First submission - error
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText("Error occurred")).toBeInTheDocument();
      });

      // Second submission - the error should be cleared during submit
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.queryByText("Error occurred")).not.toBeInTheDocument();
      });
    });
  });

  describe("Form State", () => {
    it("should allow changing currency", () => {
      render(<TenantSettingsForm {...defaultProps} />);

      const currencySelect = screen.getByLabelText("Currency") as HTMLSelectElement;
      fireEvent.change(currencySelect, { target: { value: "GBP" } });

      expect(currencySelect.value).toBe("GBP");
    });

    it("should allow changing locale", () => {
      render(<TenantSettingsForm {...defaultProps} />);

      const localeSelect = screen.getByLabelText("Locale") as HTMLSelectElement;
      fireEvent.change(localeSelect, { target: { value: "zh-CN" } });

      expect(localeSelect.value).toBe("zh-CN");
    });
  });
});
