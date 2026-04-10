import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UserDropdown } from "../UserDropdown";
import type { LoyaltyMember } from "@/contexts";

// Mock hooks
vi.mock("@/hooks", () => ({
  useFormatPhone: () => (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10) {
      const d = digits.slice(-10);
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    return phone;
  },
}));

describe("UserDropdown", () => {
  const defaultMember: LoyaltyMember = {
    id: "m-1",
    phone: "+15551234567",
    email: "john@example.com",
    firstName: "John",
    lastName: "Doe",
    points: 150,
  };

  const defaultProps = {
    member: defaultMember,
    onLogout: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render member name when firstName is available", () => {
    render(<UserDropdown {...defaultProps} />);
    expect(screen.getByText("John")).toBeInTheDocument();
  });

  it("should render formatted phone when firstName is not available", () => {
    const memberWithoutName: LoyaltyMember = {
      ...defaultMember,
      firstName: null,
    };
    render(<UserDropdown {...defaultProps} member={memberWithoutName} />);
    expect(screen.getByText("(555) 123-4567")).toBeInTheDocument();
  });

  it("should render points", () => {
    render(<UserDropdown {...defaultProps} />);
    expect(screen.getByText("150 pts")).toBeInTheDocument();
  });

  it("should render Sign Out button", () => {
    render(<UserDropdown {...defaultProps} />);
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });

  it("should call onLogout and onClose when Sign Out is clicked", async () => {
    render(<UserDropdown {...defaultProps} />);
    fireEvent.click(screen.getByText("Sign Out"));

    await waitFor(() => {
      expect(defaultProps.onLogout).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it("should close when clicking outside the dropdown", () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <UserDropdown {...defaultProps} />
      </div>
    );

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should not close when clicking inside the dropdown", () => {
    render(<UserDropdown {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText("150 pts"));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });
});
