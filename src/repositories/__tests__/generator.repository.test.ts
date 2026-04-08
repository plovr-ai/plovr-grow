import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: {
    websiteGeneration: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db";
import { GeneratorRepository } from "../generator.repository";

const repo = new GeneratorRepository();

describe("GeneratorRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findCompletedByPlaceId", () => {
    it("finds completed generation by placeId", async () => {
      const mockRecord = { id: "gen1", placeId: "ChIJ_test", status: "completed", companySlug: "joes-pizza" };
      vi.mocked(prisma.websiteGeneration.findFirst).mockResolvedValue(mockRecord as never);
      const result = await repo.findCompletedByPlaceId("ChIJ_test");
      expect(result).toEqual(mockRecord);
      expect(prisma.websiteGeneration.findFirst).toHaveBeenCalledWith({
        where: { placeId: "ChIJ_test", status: "completed" },
      });
    });

    it("returns null when no completed generation exists", async () => {
      vi.mocked(prisma.websiteGeneration.findFirst).mockResolvedValue(null);
      const result = await repo.findCompletedByPlaceId("ChIJ_nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("creates a new generation record", async () => {
      const mockRecord = { id: "gen1", placeId: "ChIJ_test", placeName: "Joe's Pizza", status: "pending" };
      vi.mocked(prisma.websiteGeneration.create).mockResolvedValue(mockRecord as never);
      const result = await repo.create("ChIJ_test", "Joe's Pizza");
      expect(result).toEqual(mockRecord);
      expect(prisma.websiteGeneration.create).toHaveBeenCalledWith({
        data: { placeId: "ChIJ_test", placeName: "Joe's Pizza" },
      });
    });
  });

  describe("getById", () => {
    it("fetches generation by id", async () => {
      const mockRecord = { id: "gen1", status: "building" };
      vi.mocked(prisma.websiteGeneration.findUnique).mockResolvedValue(mockRecord as never);
      const result = await repo.getById("gen1");
      expect(result).toEqual(mockRecord);
    });
  });

  describe("updateStatus", () => {
    it("updates status and stepDetail", async () => {
      vi.mocked(prisma.websiteGeneration.update).mockResolvedValue({} as never);
      await repo.updateStatus("gen1", "fetching_data", "Fetching restaurant info...");
      expect(prisma.websiteGeneration.update).toHaveBeenCalledWith({
        where: { id: "gen1" },
        data: { status: "fetching_data", stepDetail: "Fetching restaurant info..." },
      });
    });
  });

  describe("markCompleted", () => {
    it("marks generation as completed with tenant and slug", async () => {
      vi.mocked(prisma.websiteGeneration.update).mockResolvedValue({} as never);
      await repo.markCompleted("gen1", "tenant1", "joes-pizza");
      expect(prisma.websiteGeneration.update).toHaveBeenCalledWith({
        where: { id: "gen1" },
        data: { status: "completed", stepDetail: null, tenantId: "tenant1", companySlug: "joes-pizza" },
      });
    });
  });

  describe("markFailed", () => {
    it("marks generation as failed with error message", async () => {
      vi.mocked(prisma.websiteGeneration.update).mockResolvedValue({} as never);
      await repo.markFailed("gen1", "Google API timeout");
      expect(prisma.websiteGeneration.update).toHaveBeenCalledWith({
        where: { id: "gen1" },
        data: { status: "failed", stepDetail: null, errorMessage: "Google API timeout" },
      });
    });
  });

  describe("updateGoogleData", () => {
    it("stores Google data snapshot", async () => {
      const googleData = { name: "Joe's Pizza", address: "123 Main St" };
      vi.mocked(prisma.websiteGeneration.update).mockResolvedValue({} as never);
      await repo.updateGoogleData("gen1", googleData);
      expect(prisma.websiteGeneration.update).toHaveBeenCalledWith({
        where: { id: "gen1" },
        data: { googleData },
      });
    });
  });
});
