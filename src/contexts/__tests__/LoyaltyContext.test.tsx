import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  LoyaltyProvider,
  useLoyalty,
} from "../LoyaltyContext";
import { MerchantProvider } from "../MerchantContext";
import type { ReactNode } from "react";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create wrapper with both providers
function createWrapper(tenantId: string | null = "test-company-id") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider
        config={{
          name: "Test Merchant",
          logoUrl: null,
          currency: "USD",
          locale: "en-US",
          timezone: "America/New_York",
          tenantId,
          companySlug: "test-company",
        }}
      >
        <LoyaltyProvider>{children}</LoyaltyProvider>
      </MerchantProvider>
    );
  };
}

describe("LoyaltyContext", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("LoyaltyProvider", () => {
    it("should fetch member data on mount when tenantId is provided", async () => {
      const mockMember = {
        id: "member-123",
        phone: "+11234567890",
        name: "John Doe",
        points: 100,
      };

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              member: mockMember,
              pointsPerDollar: 2,
            },
          }),
      });

      const { result } = renderHook(() => useLoyalty(), {
        wrapper: createWrapper("test-company-id"),
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/storefront/loyalty/me?tenantId=test-company-id"
      );
      expect(result.current.member).toEqual(mockMember);
      expect(result.current.pointsPerDollar).toBe(2);
    });

    it("should not fetch when tenantId is null", async () => {
      const { result } = renderHook(() => useLoyalty(), {
        wrapper: createWrapper(null),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.member).toBeNull();
    });

    it("should handle API error gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useLoyalty(), {
        wrapper: createWrapper("test-company-id"),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.member).toBeNull();

      consoleSpy.mockRestore();
    });

    it("should handle unsuccessful API response", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false }),
      });

      const { result } = renderHook(() => useLoyalty(), {
        wrapper: createWrapper("test-company-id"),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.member).toBeNull();
    });
  });

  describe("useLoyalty", () => {
    it("should throw error when used outside provider", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useLoyalty());
      }).toThrow("useLoyalty must be used within LoyaltyProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("login", () => {
    it("should update member state", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false }),
      });

      const { result } = renderHook(() => useLoyalty(), {
        wrapper: createWrapper("test-company-id"),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const newMember = {
        id: "new-member-456",
        phone: "+10987654321",
        email: null,
        firstName: "New",
        lastName: "User",
        points: 50,
      };

      act(() => {
        result.current.login(newMember, 3);
      });

      expect(result.current.member).toEqual(newMember);
      expect(result.current.pointsPerDollar).toBe(3);
    });
  });

  describe("logout", () => {
    it("should call logout API and clear member state", async () => {
      const mockMember = {
        id: "member-123",
        phone: "+11234567890",
        name: "Test User",
        points: 100,
      };

      // Initial fetch for /me
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { member: mockMember, pointsPerDollar: 1 },
          }),
      });

      const { result } = renderHook(() => useLoyalty(), {
        wrapper: createWrapper("test-company-id"),
      });

      await waitFor(() => {
        expect(result.current.member).toEqual(mockMember);
      });

      // Logout API call
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(mockFetch).toHaveBeenLastCalledWith("/api/storefront/loyalty/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tenantId: "test-company-id" }),
      });
      expect(result.current.member).toBeNull();
    });

    it("should clear member state even if logout API fails", async () => {
      const mockMember = {
        id: "member-123",
        phone: "+11234567890",
        name: "Test User",
        points: 100,
      };

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { member: mockMember, pointsPerDollar: 1 },
          }),
      });

      const { result } = renderHook(() => useLoyalty(), {
        wrapper: createWrapper("test-company-id"),
      });

      await waitFor(() => {
        expect(result.current.member).toEqual(mockMember);
      });

      // Logout API fails
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await act(async () => {
        await result.current.logout();
      });

      // Member should still be cleared
      expect(result.current.member).toBeNull();

      consoleSpy.mockRestore();
    });

    it("should not call API when tenantId is null", async () => {
      mockFetch.mockClear();

      const { result } = renderHook(() => useLoyalty(), {
        wrapper: createWrapper(null),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.logout();
      });

      // No API calls should be made
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("refreshMember", () => {
    it("should refetch member data from API", async () => {
      const initialMember = {
        id: "member-123",
        phone: "+11234567890",
        name: "Test User",
        points: 100,
      };

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { member: initialMember, pointsPerDollar: 1 },
          }),
      });

      const { result } = renderHook(() => useLoyalty(), {
        wrapper: createWrapper("test-company-id"),
      });

      await waitFor(() => {
        expect(result.current.member).toEqual(initialMember);
      });

      // Updated member data from refresh
      const updatedMember = {
        ...initialMember,
        points: 200,
      };

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { member: updatedMember, pointsPerDollar: 2 },
          }),
      });

      await act(async () => {
        await result.current.refreshMember();
      });

      expect(result.current.member?.points).toBe(200);
      expect(result.current.pointsPerDollar).toBe(2);
    });

    it("should not refresh when there is no member", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false }),
      });

      const { result } = renderHook(() => useLoyalty(), {
        wrapper: createWrapper("test-company-id"),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockFetch.mockClear();

      await act(async () => {
        await result.current.refreshMember();
      });

      // No additional API calls should be made
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("tenant isolation", () => {
    it("should use tenantId in API requests for tenant isolation", async () => {
      const tenantIdA = "company-a-123";
      const tenantIdB = "company-b-456";

      // Test with Company A
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              member: { id: "member-a", phone: "+1", name: "User A", points: 100 },
              pointsPerDollar: 1,
            },
          }),
      });

      renderHook(() => useLoyalty(), {
        wrapper: createWrapper(tenantIdA),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/storefront/loyalty/me?tenantId=${tenantIdA}`
        );
      });

      mockFetch.mockClear();

      // Test with Company B
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              member: { id: "member-b", phone: "+2", name: "User B", points: 200 },
              pointsPerDollar: 2,
            },
          }),
      });

      renderHook(() => useLoyalty(), {
        wrapper: createWrapper(tenantIdB),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/storefront/loyalty/me?tenantId=${tenantIdB}`
        );
      });
    });
  });
});
