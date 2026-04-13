import { describe, it, expect, vi, beforeEach } from "vitest";
import { GbpLocationService } from "../gbp-location.service";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/proxy", () => ({
  getProxyDispatcher: vi.fn(() => undefined),
}));

describe("GbpLocationService", () => {
  let service: GbpLocationService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new GbpLocationService();
  });

  describe("listAccounts()", () => {
    it("should pass dispatcher to fetch when proxy is configured", async () => {
      const { getProxyDispatcher } = await import("@/lib/proxy");
      const fakeDispatcher = { fake: true };
      vi.mocked(getProxyDispatcher).mockReturnValue(fakeDispatcher as never);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ accounts: [] }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await service.listAccounts("access-token");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ dispatcher: fakeDispatcher })
      );

      vi.mocked(getProxyDispatcher).mockReturnValue(undefined);
      vi.unstubAllGlobals();
    });

    it("should fetch and return accounts from Google API", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            accounts: [
              {
                name: "accounts/123",
                accountName: "My Restaurant",
                type: "PERSONAL",
              },
            ],
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await service.listAccounts("access-token");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
        expect.objectContaining({
          headers: { Authorization: "Bearer access-token" },
        })
      );
      expect(result).toEqual([
        {
          name: "accounts/123",
          accountName: "My Restaurant",
          type: "PERSONAL",
        },
      ]);

      vi.unstubAllGlobals();
    });

    it("should return empty array when no accounts exist", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await service.listAccounts("access-token");
      expect(result).toEqual([]);

      vi.unstubAllGlobals();
    });

    it("should throw AppError when API call fails", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Unauthorized"),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(service.listAccounts("bad-token")).rejects.toThrow(
        AppError
      );

      vi.unstubAllGlobals();
    });
  });

  describe("listLocations()", () => {
    it("should pass dispatcher to fetch when proxy is configured", async () => {
      const { getProxyDispatcher } = await import("@/lib/proxy");
      const fakeDispatcher = { fake: true };
      vi.mocked(getProxyDispatcher).mockReturnValue(fakeDispatcher as never);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ locations: [] }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await service.listLocations("access-token", "accounts/123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ dispatcher: fakeDispatcher })
      );

      vi.mocked(getProxyDispatcher).mockReturnValue(undefined);
      vi.unstubAllGlobals();
    });

    it("should fetch and return locations from Google API", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            locations: [
              {
                name: "locations/456",
                title: "Downtown Branch",
                phoneNumbers: { primaryPhone: "+1234567890" },
              },
            ],
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await service.listLocations(
        "access-token",
        "accounts/123"
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://mybusinessbusinessinformation.googleapis.com/v1/accounts/123/locations"
        ),
        expect.objectContaining({
          headers: { Authorization: "Bearer access-token" },
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Downtown Branch");

      vi.unstubAllGlobals();
    });

    it("should return empty array when no locations exist", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await service.listLocations(
        "access-token",
        "accounts/123"
      );
      expect(result).toEqual([]);

      vi.unstubAllGlobals();
    });

    it("should throw AppError when API call fails", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Not Found"),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        service.listLocations("bad-token", "accounts/123")
      ).rejects.toThrow(AppError);

      vi.unstubAllGlobals();
    });
  });

  describe("getLocation()", () => {
    it("should pass dispatcher to fetch when proxy is configured", async () => {
      const { getProxyDispatcher } = await import("@/lib/proxy");
      const fakeDispatcher = { fake: true };
      vi.mocked(getProxyDispatcher).mockReturnValue(fakeDispatcher as never);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ name: "locations/456", title: "Test" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await service.getLocation("access-token", "locations/456");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ dispatcher: fakeDispatcher })
      );

      vi.mocked(getProxyDispatcher).mockReturnValue(undefined);
      vi.unstubAllGlobals();
    });

    it("should fetch a single location", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            name: "locations/456",
            title: "My Restaurant",
            websiteUri: "https://example.com",
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await service.getLocation(
        "access-token",
        "locations/456"
      );

      expect(result.name).toBe("locations/456");
      expect(result.title).toBe("My Restaurant");
      expect(result.websiteUri).toBe("https://example.com");

      vi.unstubAllGlobals();
    });

    it("should throw AppError when location fetch fails", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Not Found"),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        service.getLocation("bad-token", "locations/999")
      ).rejects.toThrow(AppError);

      vi.unstubAllGlobals();
    });
  });

  describe("mapLocationToMerchantData()", () => {
    it("should map a full GBP location to merchant data", () => {
      const result = service.mapLocationToMerchantData({
        name: "locations/456",
        title: "My Restaurant",
        phoneNumbers: { primaryPhone: "+1-555-123-4567" },
        storefrontAddress: {
          addressLines: ["123 Main St", "Suite 100"],
          locality: "San Francisco",
          administrativeArea: "CA",
          postalCode: "94102",
          regionCode: "US",
        },
        regularHours: {
          periods: [
            {
              openDay: "MONDAY",
              openTime: { hours: 9, minutes: 0 },
              closeDay: "MONDAY",
              closeTime: { hours: 17, minutes: 30 },
            },
            {
              openDay: "TUESDAY",
              openTime: { hours: 10, minutes: 0 },
              closeDay: "TUESDAY",
              closeTime: { hours: 18, minutes: 0 },
            },
          ],
        },
        websiteUri: "https://example.com",
        profile: { description: "A great restaurant" },
      });

      expect(result.address).toBe("123 Main St, Suite 100");
      expect(result.city).toBe("San Francisco");
      expect(result.state).toBe("CA");
      expect(result.zipCode).toBe("94102");
      expect(result.phone).toBe("+1-555-123-4567");
      expect(result.description).toBe("A great restaurant");
      expect(result.businessHours).toEqual({
        monday: { open: "09:00", close: "17:30" },
        tuesday: { open: "10:00", close: "18:00" },
      });
    });

    it("should handle location with minimal data", () => {
      const result = service.mapLocationToMerchantData({
        name: "locations/789",
        title: "Minimal Location",
      });

      expect(result.address).toBeUndefined();
      expect(result.city).toBeUndefined();
      expect(result.state).toBeUndefined();
      expect(result.zipCode).toBeUndefined();
      expect(result.phone).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.businessHours).toBeUndefined();
    });

    it("should handle business hours with missing minutes", () => {
      const result = service.mapLocationToMerchantData({
        name: "locations/456",
        title: "Restaurant",
        regularHours: {
          periods: [
            {
              openDay: "FRIDAY",
              openTime: { hours: 8 },
              closeDay: "FRIDAY",
              closeTime: { hours: 22 },
            },
          ],
        },
      });

      expect(result.businessHours).toEqual({
        friday: { open: "08:00", close: "22:00" },
      });
    });

    it("should skip unknown day names in business hours", () => {
      const result = service.mapLocationToMerchantData({
        name: "locations/456",
        title: "Restaurant",
        regularHours: {
          periods: [
            {
              openDay: "UNKNOWN_DAY",
              openTime: { hours: 8 },
              closeDay: "UNKNOWN_DAY",
              closeTime: { hours: 22 },
            },
          ],
        },
      });

      expect(result.businessHours).toEqual({});
    });
  });
});
