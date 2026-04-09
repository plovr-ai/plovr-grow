import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClaimBar } from "../ClaimBar";

// Mock ClaimModal to avoid testing its internals here
vi.mock("../ClaimModal", () => ({
  ClaimModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="claim-modal">Modal</div> : null,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockSessionStorage: Record<string, string> = {};

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);
  Object.defineProperty(window, "sessionStorage", {
    value: {
      getItem: (key: string) => mockSessionStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockSessionStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockSessionStorage[key];
      },
    },
    writable: true,
  });
});

describe("ClaimBar", () => {
  it("renders the claim bar with marketing copy", () => {
    render(<ClaimBar tenantId="t1" companySlug="joes-pizza" />);
    // The mobile span (sm:hidden) contains "Claim your free website!"
    expect(screen.getByText("Claim your free website!")).toBeInTheDocument();
    expect(screen.getByText("Claim Now →")).toBeInTheDocument();
  });

  it("opens ClaimModal when Claim Now is clicked", () => {
    render(<ClaimBar tenantId="t1" companySlug="joes-pizza" />);
    expect(screen.queryByTestId("claim-modal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Claim Now →"));
    expect(screen.getByTestId("claim-modal")).toBeInTheDocument();
  });

  it("hides bar when dismiss button is clicked", () => {
    render(<ClaimBar tenantId="t1" companySlug="joes-pizza" />);
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByText("Claim Now →")).not.toBeInTheDocument();
    expect(mockSessionStorage["plovr-claim-bar-dismissed"]).toBe("true");
  });

  it("stays hidden when previously dismissed in session", () => {
    mockSessionStorage["plovr-claim-bar-dismissed"] = "true";
    render(<ClaimBar tenantId="t1" companySlug="joes-pizza" />);
    expect(screen.queryByText("Claim Now →")).not.toBeInTheDocument();
  });
});
