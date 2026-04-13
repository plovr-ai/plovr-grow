import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdjustPointsModal } from "../AdjustPointsModal";

describe("AdjustPointsModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    currentBalance: 1000,
    memberName: "John Doe",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should not render when isOpen is false", () => {
      render(<AdjustPointsModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText("Adjust Points")).not.toBeInTheDocument();
    });

    it("should render when isOpen is true", () => {
      render(<AdjustPointsModal {...defaultProps} />);
      expect(screen.getByText("Adjust Points")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should display current balance", () => {
      render(<AdjustPointsModal {...defaultProps} />);
      expect(screen.getByText("Current Balance")).toBeInTheDocument();
      expect(screen.getByText("1,000")).toBeInTheDocument();
    });

    it("should have Add Points selected by default", () => {
      render(<AdjustPointsModal {...defaultProps} />);
      const addRadio = screen.getByLabelText("Add Points");
      const deductRadio = screen.getByLabelText("Deduct Points");
      expect(addRadio).toBeChecked();
      expect(deductRadio).not.toBeChecked();
    });

    it("should show required indicator for reason field", () => {
      render(<AdjustPointsModal {...defaultProps} />);
      expect(screen.getByText("*")).toBeInTheDocument();
    });
  });

  describe("Form Validation", () => {
    it("should disable confirm button when points amount is empty", () => {
      render(<AdjustPointsModal {...defaultProps} />);
      const confirmButton = screen.getByRole("button", { name: "Confirm" });
      expect(confirmButton).toBeDisabled();
    });

    it("should disable confirm button when description is empty", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      fireEvent.change(pointsInput, { target: { value: "100" } });

      const confirmButton = screen.getByRole("button", { name: "Confirm" });
      expect(confirmButton).toBeDisabled();
    });

    it("should enable confirm button when both fields are filled", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      const descriptionInput = screen.getByPlaceholderText(
        "e.g., Compensation for service issue"
      );

      fireEvent.change(pointsInput, { target: { value: "100" } });
      fireEvent.change(descriptionInput, { target: { value: "Test reason" } });

      const confirmButton = screen.getByRole("button", { name: "Confirm" });
      expect(confirmButton).toBeEnabled();
    });

    it("should only allow numeric input for points", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      fireEvent.change(pointsInput, { target: { value: "abc123def456" } });

      expect(pointsInput).toHaveValue("123456");
    });
  });

  describe("Balance Preview", () => {
    it("should show new balance when adding points", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      fireEvent.change(pointsInput, { target: { value: "500" } });

      expect(screen.getByText("+500")).toBeInTheDocument();
      expect(screen.getByText("1,500")).toBeInTheDocument(); // 1000 + 500
    });

    it("should show new balance when deducting points", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const deductRadio = screen.getByLabelText("Deduct Points");
      fireEvent.click(deductRadio);

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      fireEvent.change(pointsInput, { target: { value: "300" } });

      expect(screen.getByText("-300")).toBeInTheDocument();
      expect(screen.getByText("700")).toBeInTheDocument(); // 1000 - 300
    });

    it("should show error when deduction would result in negative balance", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const deductRadio = screen.getByLabelText("Deduct Points");
      fireEvent.click(deductRadio);

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      fireEvent.change(pointsInput, { target: { value: "1500" } });

      expect(
        screen.getByText("Cannot deduct more points than the current balance")
      ).toBeInTheDocument();

      // Confirm button should be disabled
      const descriptionInput = screen.getByPlaceholderText(
        "e.g., Compensation for service issue"
      );
      fireEvent.change(descriptionInput, { target: { value: "Test reason" } });

      const confirmButton = screen.getByRole("button", { name: "Confirm" });
      expect(confirmButton).toBeDisabled();
    });
  });

  describe("Adjustment Type Toggle", () => {
    it("should switch to deduct mode when Deduct Points is selected", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const deductRadio = screen.getByLabelText("Deduct Points");
      fireEvent.click(deductRadio);

      expect(deductRadio).toBeChecked();
      expect(screen.getByLabelText("Add Points")).not.toBeChecked();
    });

    it("should switch back to add mode from deduct mode", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const deductRadio = screen.getByLabelText("Deduct Points");
      const addRadio = screen.getByLabelText("Add Points");
      fireEvent.click(deductRadio);
      fireEvent.click(addRadio);

      expect(addRadio).toBeChecked();
      expect(deductRadio).not.toBeChecked();
    });

    it("should show negative adjustment preview in red", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const deductRadio = screen.getByLabelText("Deduct Points");
      fireEvent.click(deductRadio);

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      fireEvent.change(pointsInput, { target: { value: "200" } });

      const adjustmentText = screen.getByText("-200");
      expect(adjustmentText).toHaveClass("text-red-600");
    });

    it("should show positive adjustment preview in green", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      fireEvent.change(pointsInput, { target: { value: "200" } });

      const adjustmentText = screen.getByText("+200");
      expect(adjustmentText).toHaveClass("text-green-600");
    });
  });

  describe("Form Submission", () => {
    it("should call onConfirm with positive points when adding", async () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      const descriptionInput = screen.getByPlaceholderText(
        "e.g., Compensation for service issue"
      );

      fireEvent.change(pointsInput, { target: { value: "100" } });
      fireEvent.change(descriptionInput, { target: { value: "Bonus points" } });

      const confirmButton = screen.getByRole("button", { name: "Confirm" });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(defaultProps.onConfirm).toHaveBeenCalledWith(100, "Bonus points");
      });
    });

    it("should call onConfirm with negative points when deducting", async () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const deductRadio = screen.getByLabelText("Deduct Points");
      fireEvent.click(deductRadio);

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      const descriptionInput = screen.getByPlaceholderText(
        "e.g., Compensation for service issue"
      );

      fireEvent.change(pointsInput, { target: { value: "50" } });
      fireEvent.change(descriptionInput, { target: { value: "Refund" } });

      const confirmButton = screen.getByRole("button", { name: "Confirm" });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(defaultProps.onConfirm).toHaveBeenCalledWith(-50, "Refund");
      });
    });

    it("should show loading state while submitting", async () => {
      const slowConfirm = vi.fn(
        (_points: number, _description: string) => new Promise<void>((resolve) => setTimeout(resolve, 100))
      );
      render(<AdjustPointsModal {...defaultProps} onConfirm={slowConfirm} />);

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      const descriptionInput = screen.getByPlaceholderText(
        "e.g., Compensation for service issue"
      );

      fireEvent.change(pointsInput, { target: { value: "100" } });
      fireEvent.change(descriptionInput, { target: { value: "Test" } });

      const confirmButton = screen.getByRole("button", { name: "Confirm" });
      fireEvent.click(confirmButton);

      expect(screen.getByText("Saving...")).toBeInTheDocument();
    });

    it("should close modal on successful submission", async () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      const descriptionInput = screen.getByPlaceholderText(
        "e.g., Compensation for service issue"
      );

      fireEvent.change(pointsInput, { target: { value: "100" } });
      fireEvent.change(descriptionInput, { target: { value: "Test" } });

      const confirmButton = screen.getByRole("button", { name: "Confirm" });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it("should display error message on failed submission", async () => {
      const failingConfirm = vi
        .fn()
        .mockRejectedValue(new Error("Insufficient balance"));
      render(
        <AdjustPointsModal {...defaultProps} onConfirm={failingConfirm} />
      );

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      const descriptionInput = screen.getByPlaceholderText(
        "e.g., Compensation for service issue"
      );

      fireEvent.change(pointsInput, { target: { value: "100" } });
      fireEvent.change(descriptionInput, { target: { value: "Test" } });

      const confirmButton = screen.getByRole("button", { name: "Confirm" });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Insufficient balance")).toBeInTheDocument();
      });
    });
  });

  describe("Modal Close Behavior", () => {
    it("should call onClose when Cancel button is clicked", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onClose when clicking outside the modal", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      // Click on the backdrop (the outer div with role="dialog")
      const dialog = screen.getByRole("dialog");
      fireEvent.click(dialog);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onClose when Escape key is pressed", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should not close on non-Escape key", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: "Enter" });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it("should not respond to Escape when modal is closed", () => {
      render(<AdjustPointsModal {...defaultProps} isOpen={false} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it("should not close when clicking inside modal content", () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const modalContent = screen
        .getByText("Adjust Points")
        .closest("div.w-full") as HTMLElement;
      fireEvent.click(modalContent);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it("should reset form state when modal reopens", () => {
      const { rerender } = render(<AdjustPointsModal {...defaultProps} />);

      // Fill in some values
      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      const descriptionInput = screen.getByPlaceholderText(
        "e.g., Compensation for service issue"
      );
      fireEvent.change(pointsInput, { target: { value: "500" } });
      fireEvent.change(descriptionInput, { target: { value: "Some reason" } });

      // Close and reopen
      rerender(<AdjustPointsModal {...defaultProps} isOpen={false} />);
      rerender(<AdjustPointsModal {...defaultProps} isOpen={true} />);

      // Values should be reset
      const newPointsInput = screen.getByPlaceholderText("Enter points amount");
      expect(newPointsInput).toHaveValue("");

      const newDescriptionInput = screen.getByPlaceholderText(
        "e.g., Compensation for service issue"
      );
      expect(newDescriptionInput).toHaveValue("");
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero balance member correctly", () => {
      render(<AdjustPointsModal {...defaultProps} currentBalance={0} />);

      expect(screen.getByText("0")).toBeInTheDocument();

      // Should allow adding points
      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      const descriptionInput = screen.getByPlaceholderText(
        "e.g., Compensation for service issue"
      );

      fireEvent.change(pointsInput, { target: { value: "100" } });
      fireEvent.change(descriptionInput, { target: { value: "Initial points" } });

      expect(screen.getByText("100")).toBeInTheDocument(); // New balance
      expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
    });

    it("should not allow deducting from zero balance", () => {
      render(<AdjustPointsModal {...defaultProps} currentBalance={0} />);

      const deductRadio = screen.getByLabelText("Deduct Points");
      fireEvent.click(deductRadio);

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      const descriptionInput = screen.getByPlaceholderText(
        "e.g., Compensation for service issue"
      );

      fireEvent.change(pointsInput, { target: { value: "1" } });
      fireEvent.change(descriptionInput, { target: { value: "Test" } });

      expect(
        screen.getByText("Cannot deduct more points than the current balance")
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    });

    it("should trim description before submission", async () => {
      render(<AdjustPointsModal {...defaultProps} />);

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      const descriptionInput = screen.getByPlaceholderText(
        "e.g., Compensation for service issue"
      );

      fireEvent.change(pointsInput, { target: { value: "100" } });
      fireEvent.change(descriptionInput, {
        target: { value: "  Trimmed description  " },
      });

      const confirmButton = screen.getByRole("button", { name: "Confirm" });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(defaultProps.onConfirm).toHaveBeenCalledWith(
          100,
          "Trimmed description"
        );
      });
    });

    it("should handle large point values correctly", () => {
      render(<AdjustPointsModal {...defaultProps} currentBalance={1000000} />);

      expect(screen.getByText("1,000,000")).toBeInTheDocument();

      const pointsInput = screen.getByPlaceholderText("Enter points amount");
      fireEvent.change(pointsInput, { target: { value: "500000" } });

      expect(screen.getByText("+500,000")).toBeInTheDocument();
      expect(screen.getByText("1,500,000")).toBeInTheDocument();
    });
  });
});
