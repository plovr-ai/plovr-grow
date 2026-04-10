import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoyaltyRulesClient } from "../LoyaltyRulesClient";
import type { LoyaltyConfigData } from "@/services/loyalty/loyalty.types";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

// Mock the server action
const mockUpdateAction = vi.fn();
vi.mock(
  "@/app/(dashboard)/dashboard/(protected)/loyalty/rules/actions",
  () => ({
    updateLoyaltyConfigAction: (input: unknown) => mockUpdateAction(input),
  })
);

describe("LoyaltyRulesClient", () => {
  const mockConfig: LoyaltyConfigData = {
    id: "config-1",
    tenantId: "tenant-1",
    pointsPerDollar: 2,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRefresh.mockClear();
    mockUpdateAction.mockClear();
    mockUpdateAction.mockResolvedValue({ success: true });
  });

  describe("Rendering", () => {
    it("should render the page title and description", () => {
      render(<LoyaltyRulesClient initialConfig={null} />);

      expect(screen.getByText("Loyalty Program Settings")).toBeInTheDocument();
      expect(
        screen.getByText("Configure your loyalty program rules")
      ).toBeInTheDocument();
    });

    it("should render program status section", () => {
      render(<LoyaltyRulesClient initialConfig={null} />);

      expect(screen.getByText("Program Status")).toBeInTheDocument();
      expect(screen.getByLabelText("Active")).toBeInTheDocument();
      expect(screen.getByLabelText("Inactive")).toBeInTheDocument();
    });

    it("should render points configuration section", () => {
      render(<LoyaltyRulesClient initialConfig={null} />);

      expect(screen.getByText("Points Configuration")).toBeInTheDocument();
      expect(screen.getByLabelText("Points per Dollar")).toBeInTheDocument();
    });

    it("should render save button", () => {
      render(<LoyaltyRulesClient initialConfig={null} />);

      expect(
        screen.getByRole("button", { name: "Save Changes" })
      ).toBeInTheDocument();
    });
  });

  describe("Initial Values", () => {
    it("should use default values when initialConfig is null", () => {
      render(<LoyaltyRulesClient initialConfig={null} />);

      expect(screen.getByLabelText("Inactive")).toBeChecked();
      // Number input returns number type
      expect(screen.getByLabelText("Points per Dollar")).toHaveValue(1);
    });

    it("should use initialConfig values when provided", () => {
      render(<LoyaltyRulesClient initialConfig={mockConfig} />);

      expect(screen.getByLabelText("Active")).toBeChecked();
      // Number input returns number type
      expect(screen.getByLabelText("Points per Dollar")).toHaveValue(2);
    });
  });

  describe("Form Interactions", () => {
    it("should toggle status between active and inactive", () => {
      render(<LoyaltyRulesClient initialConfig={null} />);

      const activeRadio = screen.getByLabelText("Active");
      const inactiveRadio = screen.getByLabelText("Inactive");

      expect(inactiveRadio).toBeChecked();

      fireEvent.click(activeRadio);
      expect(activeRadio).toBeChecked();
      expect(inactiveRadio).not.toBeChecked();
    });

    it("should update points per dollar value", () => {
      render(<LoyaltyRulesClient initialConfig={null} />);

      const pointsInput = screen.getByLabelText("Points per Dollar");
      fireEvent.change(pointsInput, { target: { value: "5" } });

      // Number input returns number type
      expect(pointsInput).toHaveValue(5);
    });

    it("should show status description based on current status", () => {
      render(<LoyaltyRulesClient initialConfig={mockConfig} />);

      expect(
        screen.getByText("Customers can earn and redeem points")
      ).toBeInTheDocument();

      const inactiveRadio = screen.getByLabelText("Inactive");
      fireEvent.click(inactiveRadio);

      expect(
        screen.getByText("Loyalty program is disabled")
      ).toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("should call updateLoyaltyConfigAction with correct values on submit", async () => {
      render(<LoyaltyRulesClient initialConfig={mockConfig} />);

      const pointsInput = screen.getByLabelText("Points per Dollar");
      fireEvent.change(pointsInput, { target: { value: "3" } });

      const submitButton = screen.getByRole("button", { name: "Save Changes" });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateAction).toHaveBeenCalledWith({
          status: "active",
          pointsPerDollar: 3,
        });
      });
    });

    it("should show success message after successful save", async () => {
      mockUpdateAction.mockResolvedValue({ success: true });
      render(<LoyaltyRulesClient initialConfig={mockConfig} />);

      const submitButton = screen.getByRole("button", { name: "Save Changes" });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Loyalty configuration updated successfully")
        ).toBeInTheDocument();
      });
    });

    it("should show error message when save fails", async () => {
      mockUpdateAction.mockResolvedValue({
        success: false,
        error: "Failed to save",
      });
      render(<LoyaltyRulesClient initialConfig={mockConfig} />);

      const submitButton = screen.getByRole("button", { name: "Save Changes" });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Failed to save")).toBeInTheDocument();
      });
    });

    it("should refresh router after successful save", async () => {
      mockUpdateAction.mockResolvedValue({ success: true });
      render(<LoyaltyRulesClient initialConfig={mockConfig} />);

      const submitButton = screen.getByRole("button", { name: "Save Changes" });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe("Validation", () => {
    it("should show error for invalid points value", async () => {
      render(<LoyaltyRulesClient initialConfig={mockConfig} />);

      const pointsInput = screen.getByLabelText("Points per Dollar");
      fireEvent.change(pointsInput, { target: { value: "-1" } });

      const submitButton = screen.getByRole("button", { name: "Save Changes" });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Points per dollar must be a non-negative number")
        ).toBeInTheDocument();
      });

      expect(mockUpdateAction).not.toHaveBeenCalled();
    });

    it("should show error for non-numeric points value", async () => {
      render(<LoyaltyRulesClient initialConfig={mockConfig} />);

      const pointsInput = screen.getByLabelText("Points per Dollar");
      fireEvent.change(pointsInput, { target: { value: "abc" } });

      const submitButton = screen.getByRole("button", { name: "Save Changes" });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Points per dollar must be a non-negative number")
        ).toBeInTheDocument();
      });

      expect(mockUpdateAction).not.toHaveBeenCalled();
    });
  });
});
