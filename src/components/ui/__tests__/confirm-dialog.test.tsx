import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "../confirm-dialog";

describe("ConfirmDialog", () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render with title and message", () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Delete Item"
          message="Are you sure you want to delete this item?"
        />
      );

      expect(screen.getByText("Delete Item")).toBeInTheDocument();
      expect(
        screen.getByText("Are you sure you want to delete this item?")
      ).toBeInTheDocument();
    });

    it("should render multi-line messages correctly", () => {
      const message = `Line 1

Line 2
Line 3`;
      const { container } = render(
        <ConfirmDialog
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Remove from Category"
          message={message}
        />
      );

      // Check that the message body contains 4 paragraphs (3 text lines + 1 empty line)
      const paragraphs = container.querySelectorAll('p');

      expect(paragraphs.length).toBe(4);
      expect(paragraphs[0].textContent).toBe("Line 1");
      expect(paragraphs[1].textContent).toBe("\u00A0"); // Empty line (non-breaking space)
      expect(paragraphs[2].textContent).toBe("Line 2");
      expect(paragraphs[3].textContent).toBe("Line 3");
    });

    it("should not render when isOpen is false", () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Delete Item"
          message="Are you sure?"
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should render default button texts", () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Confirm Action"
          message="Are you sure?"
        />
      );

      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    });

    it("should render custom button texts", () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Delete Item"
          message="Are you sure?"
          confirmText="Delete"
          cancelText="No, Keep It"
        />
      );

      expect(screen.getByRole("button", { name: "No, Keep It" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    });
  });

  describe("user interactions", () => {
    it("should call onConfirm when confirm button is clicked", () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Delete Item"
          message="Are you sure?"
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when cancel button is clicked", () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Delete Item"
          message="Are you sure?"
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when close (X) button is clicked", () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Delete Item"
          message="Are you sure?"
        />
      );

      // The X button is a button with icon-sm size
      const closeButtons = screen.getAllByRole("button");
      const xButton = closeButtons.find((btn) =>
        btn.querySelector('svg')
      );

      expect(xButton).toBeDefined();
      fireEvent.click(xButton!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when backdrop is clicked", () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Delete Item"
          message="Are you sure?"
        />
      );

      // Click the backdrop (first div with fixed positioning)
      const backdrop = container.querySelector('[role="dialog"]');
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should not call onClose when dialog content is clicked", () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Delete Item"
          message="Are you sure?"
        />
      );

      // Click the dialog content area (not the backdrop)
      const dialogContent = screen.getByText("Delete Item").closest("div");
      fireEvent.click(dialogContent!);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("should call onClose when Escape key is pressed", () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Delete Item"
          message="Are you sure?"
        />
      );

      fireEvent.keyDown(document, { key: "Escape" });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("variants", () => {
    it("should render default variant correctly", () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Confirm Action"
          message="Are you sure?"
          variant="default"
        />
      );

      const confirmButton = screen.getByRole("button", { name: "Confirm" });
      expect(confirmButton).toHaveClass("bg-theme-primary");
      expect(confirmButton).toHaveClass("text-theme-primary-foreground");
    });

    it("should render destructive variant correctly", () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Delete Item"
          message="Are you sure?"
          variant="destructive"
        />
      );

      const confirmButton = screen.getByRole("button", { name: "Confirm" });
      // The destructive variant uses the Button component's destructive variant
      expect(confirmButton).toHaveAttribute("data-variant", "destructive");
    });
  });

  describe("accessibility", () => {
    it("should have correct ARIA attributes", () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Delete Item"
          message="Are you sure?"
        />
      );

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-labelledby", "confirm-dialog-title");
    });

    it("should focus confirm button when dialog opens", () => {
      const { rerender } = render(
        <ConfirmDialog
          isOpen={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Delete Item"
          message="Are you sure?"
        />
      );

      rerender(
        <ConfirmDialog
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Delete Item"
          message="Are you sure?"
        />
      );

      const confirmButton = screen.getByRole("button", { name: "Confirm" });
      expect(confirmButton).toHaveFocus();
    });
  });
});
