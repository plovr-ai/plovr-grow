import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LoyaltySection } from "../LoyaltySection";
import { MerchantProvider, LoyaltyProvider } from "@/contexts";

// ---------------------------------------------------------------------------
// URL-based fetch mock — eliminates FIFO ordering issues with
// mockResolvedValueOnce that caused flaky CI failures.
// ---------------------------------------------------------------------------
global.fetch = vi.fn();

type FetchRoutes = Record<string, object>;

/** Current route table – mutated by `setupFetchMock` / `updateFetchRoute`. */
let fetchRoutes: FetchRoutes = {};

/**
 * Install a fetch mock that dispatches by URL substring.
 * Always includes a default `/me` → not-logged-in route.
 */
function setupFetchMock(routes: FetchRoutes = {}) {
  fetchRoutes = {
    "/api/storefront/loyalty/me": { success: false, error: "Not logged in" },
    ...routes,
  };
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
    (url: string) => {
      for (const [pattern, response] of Object.entries(fetchRoutes)) {
        if (url.includes(pattern)) {
          return Promise.resolve({
            ok: true,
            json: async () => response,
          });
        }
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: false, error: "Unmatched route" }),
      });
    },
  );
}

/** Dynamically update one route without resetting the whole mock. */
function updateFetchRoute(pattern: string, response: object) {
  fetchRoutes[pattern] = response;
}

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------
const Wrapper = ({
  children,
  companySlug = "test-company",
}: {
  children: React.ReactNode;
  companySlug?: string | null;
}) => (
  <MerchantProvider
    config={{
      name: "Test Merchant",
      logoUrl: null,
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
      companySlug,
      tenantId: companySlug ? "test-company-id" : null,
    }}
  >
    <LoyaltyProvider>{children}</LoyaltyProvider>
  </MerchantProvider>
);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Enter a 6-digit OTP code, wrapped in act() to flush all async effects. */
const enterOtpCode = async (code = "123456") => {
  const inputs = screen.getAllByLabelText(/Digit \d/);
  await act(async () => {
    for (let i = 0; i < code.length; i++) {
      fireEvent.change(inputs[i], { target: { value: code[i] } });
    }
  });
};

/** Render component and wait for initial load to finish. */
const renderAndWaitForLoad = async (
  props: Parameters<typeof LoyaltySection>[0],
  companySlug?: string | null,
) => {
  render(
    <Wrapper companySlug={companySlug}>
      <LoyaltySection {...props} />
    </Wrapper>,
  );
  await waitFor(() => {
    expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
  });
};

/** Expand → enter phone → click Continue (wrapped in act). */
const expandAndSubmitPhone = async (phone = "(555) 123-4567") => {
  fireEvent.click(screen.getByText(/Sign in to earn/));
  fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
    target: { value: phone },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("LoyaltySection", () => {
  const defaultProps = {
    subtotal: 25.0,
    onMemberLogin: vi.fn(),
    onMemberLogout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupFetchMock();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  describe("when companySlug is null", () => {
    it("renders nothing", () => {
      const { container } = render(
        <Wrapper companySlug={null}>
          <LoyaltySection {...defaultProps} />
        </Wrapper>,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  describe("collapsed state", () => {
    it("shows login prompt", async () => {
      render(
        <Wrapper>
          <LoyaltySection {...defaultProps} />
        </Wrapper>,
      );
      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });
      expect(screen.getByText("rewards points")).toBeInTheDocument();
    });

    it("expands when clicked", async () => {
      await renderAndWaitForLoad(defaultProps);

      fireEvent.click(screen.getByText(/Sign in to earn/));

      expect(screen.getByText("Earn Rewards")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("(555) 123-4567"),
      ).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  describe("phone input step", () => {
    it("shows phone input and continue button", async () => {
      await renderAndWaitForLoad(defaultProps);

      fireEvent.click(screen.getByText(/Sign in to earn/));

      expect(
        screen.getByPlaceholderText("(555) 123-4567"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Continue" }),
      ).toBeInTheDocument();
    });

    it("shows cancel button", async () => {
      await renderAndWaitForLoad(defaultProps);

      fireEvent.click(screen.getByText(/Sign in to earn/));
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
    });

    it("collapses when cancel clicked", async () => {
      await renderAndWaitForLoad(defaultProps);

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(
        screen.queryByPlaceholderText("(555) 123-4567"),
      ).not.toBeInTheDocument();
    });

    it("disables continue button when phone is incomplete", async () => {
      await renderAndWaitForLoad(defaultProps);

      fireEvent.click(screen.getByText(/Sign in to earn/));

      const continueButton = screen.getByRole("button", { name: "Continue" });
      expect(continueButton).toBeDisabled();

      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123" },
      });
      expect(continueButton).toBeDisabled();
    });

    it("enables continue button when phone is complete", async () => {
      await renderAndWaitForLoad(defaultProps);

      fireEvent.click(screen.getByText(/Sign in to earn/));

      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });

      const continueButton = screen.getByRole("button", { name: "Continue" });
      expect(continueButton).not.toBeDisabled();
    });

    it("shows estimated points", async () => {
      await renderAndWaitForLoad({ ...defaultProps, subtotal: 25.5 });

      fireEvent.click(screen.getByText(/Sign in to earn/));

      expect(screen.getByText(/\+25 pts/)).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  describe("existing member flow", () => {
    it("opens OTP modal directly for existing members", async () => {
      setupFetchMock({
        "/api/storefront/loyalty/otp/send": {
          success: true,
          data: { isNewMember: false },
        },
        "/api/storefront/loyalty/status": {
          success: true,
          data: { config: { pointsPerDollar: 1 } },
        },
      });

      await renderAndWaitForLoad(defaultProps);
      await expandAndSubmitPhone();

      await waitFor(() => {
        expect(
          screen.getByText("Enter Verification Code"),
        ).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/storefront/loyalty/otp/send",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("+15551234567"),
        }),
      );
    });

    it("shows error when phone check fails", async () => {
      setupFetchMock({
        "/api/storefront/loyalty/otp/send": {
          success: false,
          error: "Phone number not found",
        },
      });

      await renderAndWaitForLoad(defaultProps);
      await expandAndSubmitPhone();

      await waitFor(() => {
        expect(
          screen.getByText("Phone number not found"),
        ).toBeInTheDocument();
      });
    });

    it("shows checking state on button", async () => {
      await renderAndWaitForLoad(defaultProps);

      // Override fetch to never resolve for the otp/send call
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string) => {
          if (url.includes("/api/storefront/loyalty/me")) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: false, error: "Not logged in" }),
            });
          }
          // Never resolve — simulates pending request
          return new Promise(() => {});
        },
      );

      fireEvent.click(screen.getByText(/Sign in to earn/));
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      expect(screen.getByText("Checking...")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  describe("new member registration flow", () => {
    beforeEach(() => {
      setupFetchMock({
        "/api/storefront/loyalty/otp/send": {
          success: true,
          data: { isNewMember: true },
        },
        "/api/storefront/loyalty/status": {
          success: true,
          data: { config: { pointsPerDollar: 1 } },
        },
      });
    });

    it("shows registration form for new members", async () => {
      await renderAndWaitForLoad(defaultProps);
      await expandAndSubmitPhone();

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText("John")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Doe")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("john@example.com"),
      ).toBeInTheDocument();
    });

    it("shows phone number as read-only in registration form", async () => {
      await renderAndWaitForLoad(defaultProps);
      await expandAndSubmitPhone();

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      expect(screen.getByText("(555) 123-4567")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Change" }),
      ).toBeInTheDocument();
    });

    it("allows going back to phone input from registration form", async () => {
      await renderAndWaitForLoad(defaultProps);
      await expandAndSubmitPhone();

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Change" }));

      expect(screen.getByText("Earn Rewards")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("(555) 123-4567"),
      ).toBeInTheDocument();
    });

    it("validates required fields before showing OTP modal", async () => {
      await renderAndWaitForLoad(defaultProps);
      await expandAndSubmitPhone();

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Send Verification Code" }),
      );

      await waitFor(() => {
        expect(
          screen.getByText("First name is required"),
        ).toBeInTheDocument();
        expect(screen.getByText("Last name is required")).toBeInTheDocument();
      });
    });

    it("validates email format", async () => {
      await renderAndWaitForLoad(defaultProps);
      await expandAndSubmitPhone();

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Doe"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
        target: { value: "invalid-email" },
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Send Verification Code" }),
      );

      await waitFor(() => {
        expect(
          screen.getByText("Please enter a valid email"),
        ).toBeInTheDocument();
      });
    });

    it("shows OTP modal after valid registration form submission", async () => {
      await renderAndWaitForLoad(defaultProps);
      await expandAndSubmitPhone();

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Doe"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
        target: { value: "john@example.com" },
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Send Verification Code" }),
      );

      await waitFor(() => {
        expect(
          screen.getByText("Enter Verification Code"),
        ).toBeInTheDocument();
      });
    });
  });

  // -----------------------------------------------------------------------
  describe("verification flow", () => {
    const setupOtpModalForExistingMember = async () => {
      setupFetchMock({
        "/api/storefront/loyalty/otp/send": {
          success: true,
          data: { isNewMember: false },
        },
        "/api/storefront/loyalty/status": {
          success: true,
          data: { config: { pointsPerDollar: 1 } },
        },
      });

      await renderAndWaitForLoad(defaultProps);
      await expandAndSubmitPhone();

      await waitFor(() => {
        expect(
          screen.getByText("Enter Verification Code"),
        ).toBeInTheDocument();
      });
    };

    it("verifies code and shows member card on success", async () => {
      await setupOtpModalForExistingMember();

      updateFetchRoute("/api/storefront/loyalty/otp/verify", {
        success: true,
        data: {
          member: {
            id: "member-1",
            phone: "+15551234567",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            points: 150,
          },
        },
      });

      await enterOtpCode();

      await waitFor(() => {
        expect(screen.getByText("Rewards Member")).toBeInTheDocument();
      });

      expect(screen.getByText("150 pts")).toBeInTheDocument();
      expect(defaultProps.onMemberLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "member-1",
          phone: "+15551234567",
          points: 150,
        }),
      );
    });

    it("shows error when verification fails", async () => {
      await setupOtpModalForExistingMember();

      updateFetchRoute("/api/storefront/loyalty/otp/verify", {
        success: false,
        error: "Invalid code",
      });

      await enterOtpCode();

      await waitFor(() => {
        expect(screen.getByText("Invalid code")).toBeInTheDocument();
      });
    });

    it("sends registration data when verifying new member", async () => {
      setupFetchMock({
        "/api/storefront/loyalty/otp/send": {
          success: true,
          data: { isNewMember: true },
        },
        "/api/storefront/loyalty/status": {
          success: true,
          data: { config: { pointsPerDollar: 1 } },
        },
      });

      await renderAndWaitForLoad(defaultProps);
      await expandAndSubmitPhone();

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Doe"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
        target: { value: "john@example.com" },
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Send Verification Code" }),
      );

      await waitFor(() => {
        expect(
          screen.getByText("Enter Verification Code"),
        ).toBeInTheDocument();
      });

      updateFetchRoute("/api/storefront/loyalty/otp/verify", {
        success: true,
        data: {
          member: {
            id: "member-1",
            phone: "+15551234567",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            points: 0,
          },
        },
      });

      await enterOtpCode();

      await waitFor(() => {
        expect(screen.getByText("Rewards Member")).toBeInTheDocument();
      });

      // Check that registration data was sent
      const verifyCall = (
        global.fetch as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        (call: string[]) => call[0] === "/api/storefront/loyalty/otp/verify",
      );
      expect(verifyCall).toBeDefined();
      const body = JSON.parse(verifyCall![1].body);
      expect(body.firstName).toBe("John");
      expect(body.lastName).toBe("Doe");
      expect(body.email).toBe("john@example.com");
    });
  });

  // -----------------------------------------------------------------------
  describe("logged in state", () => {
    const setupLoggedInState = async () => {
      setupFetchMock({
        "/api/storefront/loyalty/otp/send": {
          success: true,
          data: { isNewMember: false },
        },
        "/api/storefront/loyalty/status": {
          success: true,
          data: { config: { pointsPerDollar: 2 } },
        },
      });

      await renderAndWaitForLoad(defaultProps);
      await expandAndSubmitPhone();

      await waitFor(() => {
        expect(
          screen.getByText("Enter Verification Code"),
        ).toBeInTheDocument();
      });

      updateFetchRoute("/api/storefront/loyalty/otp/verify", {
        success: true,
        data: {
          member: {
            id: "member-1",
            phone: "+15551234567",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            points: 150,
          },
        },
      });

      await enterOtpCode();

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

      expect(
        screen.getByRole("button", { name: "Sign out" }),
      ).toBeInTheDocument();
    });

    it("signs out when sign out clicked", async () => {
      await setupLoggedInState();

      updateFetchRoute("/api/storefront/loyalty/logout", { success: true });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
      });

      await waitFor(() => {
        expect(screen.getByText(/Sign in to earn/)).toBeInTheDocument();
      });

      expect(defaultProps.onMemberLogout).toHaveBeenCalled();
    });
  });
});
