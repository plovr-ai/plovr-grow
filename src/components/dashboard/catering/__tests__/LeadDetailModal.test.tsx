import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LeadDetailModal } from "../LeadDetailModal";
import type { CateringLeadWithMerchant } from "@/services/catering/catering.types";

// Mock next/navigation
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("LeadDetailModal", () => {
  const mockLead: CateringLeadWithMerchant = {
    id: "lead-1",
    tenantId: "tenant-1",
    merchantId: "merchant-1",
    firstName: "John",
    lastName: "Doe",
    phone: "2125551234",
    email: "john@example.com",
    notes: "Birthday party for 20 people",
    status: "pending",
    createdAt: new Date("2024-01-15T10:30:00"),
    updatedAt: new Date("2024-01-15T10:30:00"),
    merchant: {
      id: "merchant-1",
      name: "Downtown Location",
      slug: "downtown",
    },
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    lead: mockLead,
    onStatusUpdate: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should not render when isOpen is false", () => {
      render(<LeadDetailModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText("Lead Details")).not.toBeInTheDocument();
    });

    it("should not render when lead is null", () => {
      render(<LeadDetailModal {...defaultProps} lead={null} />);

      expect(screen.queryByText("Lead Details")).not.toBeInTheDocument();
    });

    it("should render when isOpen is true and lead is provided", () => {
      render(<LeadDetailModal {...defaultProps} />);

      expect(screen.getByText("Lead Details")).toBeInTheDocument();
    });

    it("should display merchant name in header", () => {
      render(<LeadDetailModal {...defaultProps} />);

      expect(screen.getByText("Downtown Location")).toBeInTheDocument();
    });

    it("should display contact information", () => {
      render(<LeadDetailModal {...defaultProps} />);

      expect(screen.getByText("Contact Information")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("(212) 555-1234")).toBeInTheDocument();
      expect(screen.getByText("john@example.com")).toBeInTheDocument();
    });

    it("should display status badge with capitalized text", () => {
      render(<LeadDetailModal {...defaultProps} />);

      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("should display notes when present", () => {
      render(<LeadDetailModal {...defaultProps} />);

      expect(screen.getByText("Notes")).toBeInTheDocument();
      expect(
        screen.getByText("Birthday party for 20 people")
      ).toBeInTheDocument();
    });

    it("should not display notes section when notes is null", () => {
      const leadWithoutNotes = { ...mockLead, notes: null };
      render(<LeadDetailModal {...defaultProps} lead={leadWithoutNotes} />);

      expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    });

    it("should display submitted date", () => {
      render(<LeadDetailModal {...defaultProps} />);

      expect(screen.getByText(/Submitted/)).toBeInTheDocument();
    });
  });

  describe("Status-based Actions", () => {
    it("should show Mark Contacted and Cancel Lead for pending status", () => {
      render(<LeadDetailModal {...defaultProps} />);

      expect(screen.getByText("Mark Contacted")).toBeInTheDocument();
      expect(screen.getByText("Cancel Lead")).toBeInTheDocument();
      expect(screen.getByText("Create Order")).toBeInTheDocument();
    });

    it("should not show Mark Contacted for contacted status", () => {
      const contactedLead = { ...mockLead, status: "contacted" };
      render(<LeadDetailModal {...defaultProps} lead={contactedLead} />);

      expect(screen.queryByText("Mark Contacted")).not.toBeInTheDocument();
      expect(screen.getByText("Cancel Lead")).toBeInTheDocument();
      expect(screen.getByText("Create Order")).toBeInTheDocument();
    });

    it("should not show any action buttons for completed status", () => {
      const completedLead = { ...mockLead, status: "completed" };
      render(<LeadDetailModal {...defaultProps} lead={completedLead} />);

      expect(screen.queryByText("Mark Contacted")).not.toBeInTheDocument();
      expect(screen.queryByText("Cancel Lead")).not.toBeInTheDocument();
      expect(screen.queryByText("Create Order")).not.toBeInTheDocument();
    });

    it("should not show any action buttons for cancelled status", () => {
      const cancelledLead = { ...mockLead, status: "cancelled" };
      render(<LeadDetailModal {...defaultProps} lead={cancelledLead} />);

      expect(screen.queryByText("Mark Contacted")).not.toBeInTheDocument();
      expect(screen.queryByText("Cancel Lead")).not.toBeInTheDocument();
      expect(screen.queryByText("Create Order")).not.toBeInTheDocument();
    });
  });

  describe("Status Update", () => {
    it("should call onStatusUpdate with 'contacted' when clicking Mark Contacted", async () => {
      render(<LeadDetailModal {...defaultProps} />);

      const markContactedBtn = screen.getByText("Mark Contacted");
      fireEvent.click(markContactedBtn);

      await waitFor(() => {
        expect(defaultProps.onStatusUpdate).toHaveBeenCalledWith(
          "lead-1",
          "contacted"
        );
      });
    });

    it("should call onStatusUpdate with 'cancelled' when clicking Cancel Lead", async () => {
      render(<LeadDetailModal {...defaultProps} />);

      const cancelBtn = screen.getByText("Cancel Lead");
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(defaultProps.onStatusUpdate).toHaveBeenCalledWith(
          "lead-1",
          "cancelled"
        );
      });
    });

    it("should disable buttons while updating", async () => {
      const slowUpdate = vi.fn(
        () => new Promise<void>((resolve) => setTimeout(resolve, 100))
      );
      render(
        <LeadDetailModal {...defaultProps} onStatusUpdate={slowUpdate} />
      );

      const markContactedBtn = screen.getByText("Mark Contacted");
      fireEvent.click(markContactedBtn);

      // Buttons should be disabled during update
      await waitFor(() => {
        expect(markContactedBtn).toBeDisabled();
      });
    });
  });

  describe("Create Order", () => {
    it("should navigate to create order page with correct params", () => {
      render(<LeadDetailModal {...defaultProps} />);

      const createOrderBtn = screen.getByText("Create Order");
      fireEvent.click(createOrderBtn);

      expect(defaultProps.onClose).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(
        "/dashboard/catering/orders/new?leadId=lead-1&merchantId=merchant-1"
      );
    });
  });

  describe("Close Behavior", () => {
    it("should call onClose when X button is clicked", () => {
      render(<LeadDetailModal {...defaultProps} />);

      // Find the close button (X icon button in header)
      const buttons = screen.getAllByRole("button");
      const closeBtn = buttons.find((btn) =>
        btn.querySelector("svg.lucide-x")
      );
      expect(closeBtn).toBeDefined();
      fireEvent.click(closeBtn!);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onClose when clicking backdrop", () => {
      render(<LeadDetailModal {...defaultProps} />);

      const dialog = screen.getByRole("dialog");
      fireEvent.click(dialog);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should not close when clicking modal content", () => {
      render(<LeadDetailModal {...defaultProps} />);

      const modalContent = screen.getByText("Lead Details").closest(
        "div.w-full"
      ) as HTMLElement;
      fireEvent.click(modalContent);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it("should close on Escape key", () => {
      render(<LeadDetailModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should not close on non-Escape key", () => {
      render(<LeadDetailModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: "Enter" });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe("Status Badge Colors", () => {
    it("should apply yellow styling for pending status", () => {
      render(<LeadDetailModal {...defaultProps} />);

      const badge = screen.getByText("Pending");
      expect(badge.className).toContain("bg-yellow-100");
      expect(badge.className).toContain("text-yellow-800");
    });

    it("should apply blue styling for contacted status", () => {
      const contactedLead = { ...mockLead, status: "contacted" };
      render(<LeadDetailModal {...defaultProps} lead={contactedLead} />);

      const badge = screen.getByText("Contacted");
      expect(badge.className).toContain("bg-blue-100");
      expect(badge.className).toContain("text-blue-800");
    });

    it("should apply green styling for completed status", () => {
      const completedLead = { ...mockLead, status: "completed" };
      render(<LeadDetailModal {...defaultProps} lead={completedLead} />);

      const badge = screen.getByText("Completed");
      expect(badge.className).toContain("bg-green-100");
      expect(badge.className).toContain("text-green-800");
    });

    it("should apply gray styling for cancelled status", () => {
      const cancelledLead = { ...mockLead, status: "cancelled" };
      render(<LeadDetailModal {...defaultProps} lead={cancelledLead} />);

      const badge = screen.getByText("Cancelled");
      expect(badge.className).toContain("bg-gray-100");
      expect(badge.className).toContain("text-gray-800");
    });

    it("should apply fallback gray styling for unknown status", () => {
      const unknownLead = { ...mockLead, status: "unknown_status" };
      render(<LeadDetailModal {...defaultProps} lead={unknownLead} />);

      const badge = screen.getByText("Unknown_status");
      expect(badge.className).toContain("bg-gray-100");
      expect(badge.className).toContain("text-gray-800");
    });
  });
});
