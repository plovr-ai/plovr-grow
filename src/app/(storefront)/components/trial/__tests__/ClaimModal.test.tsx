import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClaimModal } from "../ClaimModal";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

const mockSignIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

// The ClaimModal labels are plain <label> elements without htmlFor.
// We query inputs by their order within the form using getAllByRole.
function getFormInputs() {
  const textboxes = screen.getAllByRole("textbox");
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  return {
    name: textboxes[0],
    email: textboxes[1],
    password: passwordInputs[0] as HTMLElement,
    confirmPassword: passwordInputs[1] as HTMLElement,
  };
}

function fillForm(overrides: Record<string, string> = {}) {
  const defaults = {
    name: "John Doe",
    email: "john@test.com",
    password: "SecurePass1",
    confirmPassword: "SecurePass1",
  };
  const values = { ...defaults, ...overrides };
  const inputs = getFormInputs();
  fireEvent.change(inputs.name, { target: { value: values.name } });
  fireEvent.change(inputs.email, { target: { value: values.email } });
  fireEvent.change(inputs.password, { target: { value: values.password } });
  fireEvent.change(inputs.confirmPassword, {
    target: { value: values.confirmPassword },
  });
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
    expect(screen.getByText("Password")).toBeInTheDocument();
    expect(screen.getByText("Confirm Password")).toBeInTheDocument();
    // Check input fields
    const inputs = getFormInputs();
    expect(inputs.name).toBeInTheDocument();
    expect(inputs.email).toBeInTheDocument();
    expect(inputs.password).toBeInTheDocument();
    expect(inputs.confirmPassword).toBeInTheDocument();
  });

  it("shows validation error when passwords don't match", async () => {
    render(<ClaimModal {...defaultProps} />);
    fillForm({ confirmPassword: "DifferentPass1" });
    fireEvent.click(screen.getByText("Claim Website"));
    await waitFor(() => {
      expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    });
  });

  it("calls claim API and redirects on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () =>
        Promise.resolve({ success: true, companySlug: "joes-pizza" }),
    } as Response);
    mockSignIn.mockResolvedValue({ error: null });

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
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: "john@test.com",
        password: "SecurePass1",
        redirect: false,
      });
      expect(mockPush).toHaveBeenCalledWith(
        "/claim/success?company=joes-pizza"
      );
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

  it("redirects to login when sign-in fails after claim", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () =>
        Promise.resolve({ success: true, companySlug: "joes-pizza" }),
    } as Response);
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" });

    render(<ClaimModal {...defaultProps} />);
    fillForm();
    fireEvent.click(screen.getByText("Claim Website"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/login");
    });
  });
});
