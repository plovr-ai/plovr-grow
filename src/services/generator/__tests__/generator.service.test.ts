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

vi.mock("@/repositories/company.repository", () => ({
  companyRepository: {
    create: vi.fn(),
    getBySlug: vi.fn(),
  },
}));

vi.mock("@/repositories/merchant.repository", () => ({
  merchantRepository: {
    create: vi.fn(),
    isSlugAvailable: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  default: {
    tenant: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn().mockReturnValue("mock-entity-id"),
}));

import { generatorRepository } from "@/repositories/generator.repository";
import { companyRepository } from "@/repositories/company.repository";
import { merchantRepository } from "@/repositories/merchant.repository";
import prisma from "@/lib/db";
import { GeneratorService } from "../generator.service";
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
        companySlug: "joes-pizza",
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
        companySlug: null, errorMessage: null,
      } as never);

      const result = await service.getStatus("gen1");
      expect(result).toEqual({
        status: "building", stepDetail: "Creating tenant...",
        companySlug: null, errorMessage: null,
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
    };

    it("runs the full generation pipeline successfully", async () => {
      vi.mocked(generatorRepository.getById).mockResolvedValue({
        id: "gen1", placeId: "ChIJ_test", placeName: "Joe's Pizza",
      } as never);
      mockGetPlaceDetails.mockResolvedValue(mockPlaceDetails);
      vi.mocked(companyRepository.getBySlug).mockResolvedValue(null);
      vi.mocked(merchantRepository.isSlugAvailable).mockResolvedValue(true);
      vi.mocked(prisma.tenant.create).mockResolvedValue({ id: "mock-entity-id" } as never);
      vi.mocked(companyRepository.create).mockResolvedValue({ id: "mock-entity-id", slug: "joes-pizza" } as never);
      vi.mocked(merchantRepository.create).mockResolvedValue({ id: "mock-entity-id" } as never);

      await service.generate("gen1");

      expect(generatorRepository.updateStatus).toHaveBeenCalledWith("gen1", "fetching_data", expect.any(String));
      expect(mockGetPlaceDetails).toHaveBeenCalledWith("ChIJ_test");
      expect(generatorRepository.updateGoogleData).toHaveBeenCalled();
      expect(generatorRepository.updateStatus).toHaveBeenCalledWith("gen1", "building", expect.any(String));
      expect(prisma.tenant.create).toHaveBeenCalled();
      expect(companyRepository.create).toHaveBeenCalled();
      expect(merchantRepository.create).toHaveBeenCalled();
      expect(generatorRepository.markCompleted).toHaveBeenCalledWith("gen1", "mock-entity-id", expect.any(String));
    });

    it("marks generation as failed when Google API throws", async () => {
      vi.mocked(generatorRepository.getById).mockResolvedValue({
        id: "gen1", placeId: "ChIJ_test", placeName: "Failing Place",
      } as never);
      mockGetPlaceDetails.mockRejectedValue(new Error("API timeout"));

      await service.generate("gen1");
      expect(generatorRepository.markFailed).toHaveBeenCalledWith("gen1", "API timeout");
    });
  });
});
