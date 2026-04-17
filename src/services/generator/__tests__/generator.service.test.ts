import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/repositories/generator.repository", () => ({
  generatorRepository: {
    findCompletedByPlaceId: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    updateStatus: vi.fn(),
    markCompleted: vi.fn(),
    markFailed: vi.fn(),
    updateGoogleData: vi.fn(),
  },
}));

vi.mock("@/services/tenant/tenant.service", () => ({
  tenantService: {
    createTenantWithMerchant: vi.fn(),
  },
}));

vi.mock("../google-places.client", () => {
  const MockGooglePlacesClient = vi.fn().mockImplementation(function () {
    return { getPlaceDetails: vi.fn() };
  });
  return { GooglePlacesClient: MockGooglePlacesClient };
});

import { generatorRepository } from "@/repositories/generator.repository";
import { tenantService } from "@/services/tenant/tenant.service";
import { GeneratorService, getGeneratorService } from "../generator.service";
import type { PlaceDetails } from "../google-places.client";

const mockGetPlaceDetails = vi.fn();
const service = new GeneratorService({
  getPlaceDetails: mockGetPlaceDetails,
} as never);

describe("GeneratorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("returns existingSlug when placeId already has a completed generation", async () => {
      vi.mocked(generatorRepository.findCompletedByPlaceId).mockResolvedValue({
        id: "gen1",
        tenantSlug: "joes-pizza",
      } as never);

      const result = await service.create({ placeId: "ChIJ_test", placeName: "Joe's Pizza" });
      expect(result).toEqual({ existingSlug: "joes-pizza" });
      expect(generatorRepository.create).not.toHaveBeenCalled();
    });

    it("creates new generation when placeId has no completed record", async () => {
      vi.mocked(generatorRepository.findCompletedByPlaceId).mockResolvedValue(null);
      vi.mocked(generatorRepository.create).mockResolvedValue({ id: "gen-new" } as never);

      const result = await service.create({ placeId: "ChIJ_new", placeName: "New Place" });
      expect(result).toEqual({ generationId: "gen-new" });
      expect(generatorRepository.create).toHaveBeenCalledWith("ChIJ_new", "New Place");
    });
  });

  describe("getStatus", () => {
    it("returns generation status", async () => {
      vi.mocked(generatorRepository.getById).mockResolvedValue({
        id: "gen1", status: "building", stepDetail: "Creating tenant...",
        tenantSlug: null, errorMessage: null,
      } as never);

      const result = await service.getStatus("gen1");
      expect(result).toEqual({
        status: "building", stepDetail: "Creating tenant...",
        tenantSlug: null, errorMessage: null,
      });
    });

    it("returns null for non-existent generation", async () => {
      vi.mocked(generatorRepository.getById).mockResolvedValue(null);
      const result = await service.getStatus("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("generate", () => {
    const mockPlaceDetails: PlaceDetails = {
      name: "Joe's Pizza",
      address: "123 Main St, New York, NY 10001",
      city: "New York", state: "NY", zipCode: "10001",
      phone: "(212) 555-0100",
      websiteUrl: "https://joespizza.com",
      googleMapsUrl: "https://maps.google.com/place/abc",
      businessHours: { monday: { open: "11:00", close: "22:00", closed: false } },
      photoReferences: ["places/abc/photos/photo1"],
      reviews: [{ author: "John", rating: 5, text: "Great!", relativeTime: "1 month ago" }],
      primaryType: "pizza_restaurant",
      types: ["pizza_restaurant", "restaurant", "food"],
    };

    it("runs the full generation pipeline successfully", async () => {
      vi.mocked(generatorRepository.getById).mockResolvedValue({
        id: "gen1", placeId: "ChIJ_test", placeName: "Joe's Pizza",
      } as never);
      mockGetPlaceDetails.mockResolvedValue(mockPlaceDetails);
      vi.mocked(tenantService.createTenantWithMerchant).mockResolvedValue({
        tenant: {
          id: "tenant-1",
          slug: "joes-pizza",
          name: "Joe's Pizza",
        } as never,
        merchant: {
          id: "merchant-1",
          slug: "joes-pizza",
          name: "Joe's Pizza",
          tenantId: "tenant-1",
        } as never,
      });

      await service.generate("gen1");

      expect(generatorRepository.updateStatus).toHaveBeenCalledWith("gen1", "fetching_data", expect.any(String));
      expect(mockGetPlaceDetails).toHaveBeenCalledWith("ChIJ_test");
      expect(generatorRepository.updateGoogleData).toHaveBeenCalled();
      expect(generatorRepository.updateStatus).toHaveBeenCalledWith("gen1", "building", expect.any(String));
      expect(tenantService.createTenantWithMerchant).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Joe's Pizza",
          source: "generator",
          websiteUrl: "https://joespizza.com",
          merchant: expect.objectContaining({
            address: "123 Main St, New York, NY 10001",
            city: "New York",
            state: "NY",
            zipCode: "10001",
            phone: "(212) 555-0100",
          }),
        })
      );
      expect(generatorRepository.markCompleted).toHaveBeenCalledWith("gen1", "tenant-1", "joes-pizza");
    });

    it("should return early when generation not found", async () => {
      vi.mocked(generatorRepository.getById).mockResolvedValue(null);

      await service.generate("non-existent");

      expect(generatorRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockGetPlaceDetails).not.toHaveBeenCalled();
    });

    it("should handle non-Error thrown during generation", async () => {
      vi.mocked(generatorRepository.getById).mockResolvedValue({
        id: "gen1", placeId: "ChIJ_test", placeName: "Bad Place",
      } as never);
      mockGetPlaceDetails.mockRejectedValue("string error");

      await service.generate("gen1");
      expect(generatorRepository.markFailed).toHaveBeenCalledWith("gen1", "Unknown error");
    });

    it("marks generation as failed when Google API throws", async () => {
      vi.mocked(generatorRepository.getById).mockResolvedValue({
        id: "gen1", placeId: "ChIJ_test", placeName: "Failing Place",
      } as never);
      mockGetPlaceDetails.mockRejectedValue(new Error("API timeout"));

      await service.generate("gen1");
      expect(generatorRepository.markFailed).toHaveBeenCalledWith("gen1", "API timeout");
    });

    it("assigns websiteTemplate based on primaryType from PlaceDetails", async () => {
      const cafePlaceDetails: PlaceDetails = {
        ...mockPlaceDetails,
        name: "Sunny Cafe",
        primaryType: "cafe",
        types: ["cafe", "restaurant", "food"],
      };

      vi.mocked(generatorRepository.getById).mockResolvedValue({
        id: "gen1", placeId: "ChIJ_cafe", placeName: "Sunny Cafe",
      } as never);
      mockGetPlaceDetails.mockResolvedValue(cafePlaceDetails);
      vi.mocked(tenantService.createTenantWithMerchant).mockResolvedValue({
        tenant: { id: "tenant-cafe", slug: "sunny-cafe", name: "Sunny Cafe" } as never,
        merchant: { id: "merchant-cafe", slug: "sunny-cafe", name: "Sunny Cafe", tenantId: "tenant-cafe" } as never,
      });

      await service.generate("gen1");

      expect(tenantService.createTenantWithMerchant).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            websiteTemplate: "cafe_bakery",
          }),
        })
      );
    });
  });

  describe("create - edge case", () => {
    it("creates new generation when findCompleted returns record without tenantSlug", async () => {
      vi.mocked(generatorRepository.findCompletedByPlaceId).mockResolvedValue({
        id: "gen1",
        tenantSlug: null,
      } as never);
      vi.mocked(generatorRepository.create).mockResolvedValue({ id: "gen-new" } as never);

      const result = await service.create({ placeId: "ChIJ_test", placeName: "Test" });
      expect(result).toEqual({ generationId: "gen-new" });
    });
  });
});

describe("getGeneratorService", () => {
  it("returns a GeneratorService singleton", () => {
    const svc1 = getGeneratorService();
    expect(svc1).toBeInstanceOf(GeneratorService);
    const svc2 = getGeneratorService();
    expect(svc1).toBe(svc2);
  });
});

