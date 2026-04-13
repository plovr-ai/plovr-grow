import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClaimModal } from "../ClaimModal";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

// The ClaimModal labels are plain <label> elements without htmlFor.
// We query inputs by their order within the form using getAllByRole.
function getFormInputs() {
  const textboxes = screen.getAllByRole("textbox");
  return {
    name: textboxes[0],
    email: textboxes[1],
  };
}

function fillForm(overrides: Record<string, string> = {}) {
  const defaults = {
    name: "John Doe",
    email: "john@test.com",
  };
  const values = { ...defaults, ...overrides };
  const inputs = getFormInputs();
  fireEvent.change(inputs.name, { target: { value: values.name } });
  fireEvent.change(inputs.email, { target: { value: values.email } });
}

describe("ClaimModal", () => {
  const defaultProps = {
    tenantId: "t1",
    companySlug: "joes-pizza",
    isOpen: true,
    onClose: vi.fn(),
  };

  it("does not render when isOpen is false", () => {
    render(<ClaimModal {...defaultProps} isOpen={false} />);
    expect(
      screen.queryByText("Claim Your Restaurant Website")
    ).not.toBeInTheDocument();
  });

  it("renders form fields when open", () => {
    render(<ClaimModal {...defaultProps} />);
    expect(
      screen.getByText("Claim Your Restaurant Website")
    ).toBeInTheDocument();
    // Check labels are present
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    // Check input fields
    const inputs = getFormInputs();
    expect(inputs.name).toBeInTheDocument();
    expect(inputs.email).toBeInTheDocument();
  });

  it("calls claim API and redirects on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () =>
        Promise.resolve({ success: true, companySlug: "joes-pizza" }),
    } as Response);

    render(<ClaimModal {...defaultProps} />);
    fillForm();
    fireEvent.click(screen.getByText("Claim Website"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/claim",
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(mockPush).toHaveBeenCalledWith(
        "/claim/success?company=joes-pizza"
      );
    });
  });

  it("shows name validation error for short name", async () => {
    render(<ClaimModal {...defaultProps} />);
    fillForm({ name: "J" });
    const form = document.querySelector("form");
    fireEvent.submit(form!);
    await waitFor(() => {
      expect(screen.getByText("Name must be at least 2 characters")).toBeInTheDocument();
    });
  });

  it("shows email validation error for invalid email", async () => {
    render(<ClaimModal {...defaultProps} />);
    fillForm({ email: "not-an-email" });
    const form = document.querySelector("form");
    fireEvent.submit(form!);
    await waitFor(() => {
      expect(screen.getByText("Please enter a valid email")).toBeInTheDocument();
    });
  });

  it("shows default error when API returns success false without error", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () =>
        Promise.resolve({ success: false }),
    } as Response);

    render(<ClaimModal {...defaultProps} />);
    fillForm();
    fireEvent.click(screen.getByText("Claim Website"));

    await waitFor(() => {
      expect(screen.getByText("Failed to claim website")).toBeInTheDocument();
    });
  });

  it("shows server error message on claim failure", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () =>
        Promise.resolve({ success: false, error: "Email already exists" }),
    } as Response);

    render(<ClaimModal {...defaultProps} />);
    fillForm();
    fireEvent.click(screen.getByText("Claim Website"));

    await waitFor(() => {
      expect(screen.getByText("Email already exists")).toBeInTheDocument();
    });
  });

  it("shows network error when fetch throws", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

    render(<ClaimModal {...defaultProps} />);
    fillForm();
    fireEvent.click(screen.getByText("Claim Website"));

    await waitFor(() => {
      expect(screen.getByText("Network error. Please try again.")).toBeInTheDocument();
    });
  });

});
