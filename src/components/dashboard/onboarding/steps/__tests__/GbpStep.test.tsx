import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GbpStep } from "../GbpStep";

// Mock next-intl with stable function references
const messages: Record<string, string> = {
  "onboarding.steps.gbp.pendingWhy": "Put your restaurant on the map",
  "onboarding.steps.gbp.pendingEffect": "After connecting",
  "onboarding.steps.gbp.pendingAction": "Connect Google Business",
  "onboarding.steps.gbp.completedDescription": "Every Google search",
  "onboarding.steps.gbp.completedAction": "View on Google Maps",
  "onboarding.steps.gbp.loadingLocations": "Loading your business locations...",
  "onboarding.steps.gbp.selectLocationTitle": "Select your business location",
  "onboarding.steps.gbp.selectLocationDescription": "We found multiple locations",
  "onboarding.steps.gbp.selectButton": "Select",
  "onboarding.steps.gbp.syncing": "Syncing location data...",
  "onboarding.steps.gbp.syncError": "Failed to sync location data",
  "onboarding.steps.gbp.retryButton": "Retry",
  "onboarding.steps.gbp.noLocations": "No locations found",
  "onboarding.skipButton": "Skip for now",
};

const translationFns = new Map<string, (key: string) => string>();
function getTranslationFn(namespace: string) {
  if (!translationFns.has(namespace)) {
    translationFns.set(namespace, (key: string) => {
      const fullKey = `${namespace}.${key}`;
      return messages[fullKey] ?? key;
    });
  }
  return translationFns.get(namespace)!;
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => getTranslationFn(namespace),
}));

// Mock next/navigation
const mockRefresh = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
  useSearchParams: () => mockSearchParams,
}));

// Mock DashboardContext
vi.mock("@/contexts/DashboardContext", () => ({
  useDashboard: () => ({
    merchants: [{ id: "merchant-1", name: "Test Restaurant", slug: "test" }],
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GbpStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Reset searchParams
    for (const key of [...mockSearchParams.keys()]) {
      mockSearchParams.delete(key);
    }
  });

  it("should render pending state with connect and skip buttons", () => {
    render(<GbpStep status="pending" />);

    expect(screen.getByText("Put your restaurant on the map")).toBeInTheDocument();
    expect(screen.getByText("Connect Google Business")).toBeInTheDocument();
    expect(screen.getByText("Skip for now")).toBeInTheDocument();
  });

  it("should render completed state", () => {
    render(<GbpStep status="completed" />);

    expect(screen.getByText("Every Google search")).toBeInTheDocument();
    expect(screen.getByText("View on Google Maps")).toBeInTheDocument();
  });

  it("should redirect to OAuth URL when connect is clicked", () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });

    render(<GbpStep status="pending" />);
    fireEvent.click(screen.getByText("Connect Google Business"));

    expect(window.location.href).toContain("/api/integration/gbp/oauth/authorize");
    expect(window.location.href).toContain("merchantId=merchant-1");

    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("should call skip API when skip button is clicked", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    render(<GbpStep status="pending" />);
    fireEvent.click(screen.getByText("Skip for now"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/dashboard/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: "gbp", status: "skipped" }),
      });
    });
  });

  it("should auto-select single location after OAuth return", async () => {
    mockSearchParams.set("onboarding_step", "gbp");
    mockSearchParams.set("action", "complete");

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/integration/gbp/locations/sync")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      // Default: locations list with single location
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [{ name: "locations/123", title: "Downtown" }] }),
      });
    });

    render(<GbpStep status="pending" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/integration/gbp/locations/sync",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            merchantId: "merchant-1",
            locationName: "locations/123",
          }),
        })
      );
    });
  });

  it("should show location selection UI when multiple locations returned", async () => {
    mockSearchParams.set("onboarding_step", "gbp");
    mockSearchParams.set("action", "complete");

    const multipleLocations = [
      { name: "locations/1", title: "Downtown Branch" },
      { name: "locations/2", title: "Uptown Branch" },
    ];

    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: multipleLocations }),
      })
    );

    render(<GbpStep status="pending" />);

    await waitFor(() => {
      expect(screen.getByText("Select your business location")).toBeInTheDocument();
    });

    expect(screen.getByText("Downtown Branch")).toBeInTheDocument();
    expect(screen.getByText("Uptown Branch")).toBeInTheDocument();
    expect(screen.getAllByText("Select")).toHaveLength(2);
  });

  it("should sync location when user selects from multiple locations", async () => {
    mockSearchParams.set("onboarding_step", "gbp");
    mockSearchParams.set("action", "complete");

    const multipleLocations = [
      { name: "locations/1", title: "Downtown Branch" },
      { name: "locations/2", title: "Uptown Branch" },
    ];

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/integration/gbp/locations/sync")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: multipleLocations }),
      });
    });

    render(<GbpStep status="pending" />);

    const selectButtons = await screen.findAllByText("Select");
    expect(screen.getByText("Downtown Branch")).toBeInTheDocument();

    fireEvent.click(selectButtons[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/integration/gbp/locations/sync",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            merchantId: "merchant-1",
            locationName: "locations/1",
          }),
        })
      );
    });
  });

  it("should show no locations message when API returns empty list", async () => {
    mockSearchParams.set("onboarding_step", "gbp");
    mockSearchParams.set("action", "complete");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    render(<GbpStep status="pending" />);

    await waitFor(() => {
      expect(screen.getByText("No locations found")).toBeInTheDocument();
    });
  });

  it("should show error state when fetch locations fails", async () => {
    mockSearchParams.set("onboarding_step", "gbp");
    mockSearchParams.set("action", "complete");

    mockFetch.mockResolvedValueOnce({ ok: false });

    render(<GbpStep status="pending" />);

    await screen.findByText("Failed to sync location data");
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

});
