import { describe, it, expect, vi, beforeEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { LoyaltyConfigService } from "../loyalty-config.service";

// Mock repository
vi.mock("@/repositories/loyalty-config.repository", () => ({
  loyaltyConfigRepository: {
    getByCompanyId: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    setStatus: vi.fn(),
  },
}));

import { loyaltyConfigRepository } from "@/repositories/loyalty-config.repository";

describe("LoyaltyConfigService", () => {
  let service: LoyaltyConfigService;

  const mockConfig = {
    id: "config-1",
    tenantId: "tenant-1",
    companyId: "company-1",
    pointsPerDollar: new Decimal(1.5),
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyConfigService();
  });

  describe("getLoyaltyConfig", () => {
    it("should return loyalty config for a company", async () => {
      vi.mocked(loyaltyConfigRepository.getByCompanyId).mockResolvedValue(mockConfig);

      const result = await service.getLoyaltyConfig("tenant-1", "company-1");

      expect(result).toEqual({
        id: "config-1",
        tenantId: "tenant-1",
        companyId: "company-1",
        pointsPerDollar: 1.5,
        status: "active",
        createdAt: mockConfig.createdAt,
        updatedAt: mockConfig.updatedAt,
      });

      expect(loyaltyConfigRepository.getByCompanyId).toHaveBeenCalledWith(
        "tenant-1",
        "company-1"
      );
    });

    it("should return null if config not found", async () => {
      vi.mocked(loyaltyConfigRepository.getByCompanyId).mockResolvedValue(null);

      const result = await service.getLoyaltyConfig("tenant-1", "company-1");

      expect(result).toBeNull();
    });
  });

  describe("isLoyaltyEnabled", () => {
    it("should return true if loyalty is active", async () => {
      vi.mocked(loyaltyConfigRepository.getByCompanyId).mockResolvedValue(mockConfig);

      const result = await service.isLoyaltyEnabled("tenant-1", "company-1");

      expect(result).toBe(true);
    });

    it("should return false if loyalty is inactive", async () => {
      vi.mocked(loyaltyConfigRepository.getByCompanyId).mockResolvedValue({
        ...mockConfig,
        status: "inactive",
      });

      const result = await service.isLoyaltyEnabled("tenant-1", "company-1");

      expect(result).toBe(false);
    });

    it("should return false if config not found", async () => {
      vi.mocked(loyaltyConfigRepository.getByCompanyId).mockResolvedValue(null);

      const result = await service.isLoyaltyEnabled("tenant-1", "company-1");

      expect(result).toBe(false);
    });
  });

  describe("getPointsPerDollar", () => {
    it("should return configured points per dollar", async () => {
      vi.mocked(loyaltyConfigRepository.getByCompanyId).mockResolvedValue(mockConfig);

      const result = await service.getPointsPerDollar("tenant-1", "company-1");

      expect(result).toBe(1.5);
    });

    it("should return default 1 if config not found", async () => {
      vi.mocked(loyaltyConfigRepository.getByCompanyId).mockResolvedValue(null);

      const result = await service.getPointsPerDollar("tenant-1", "company-1");

      expect(result).toBe(1);
    });
  });

  describe("upsertLoyaltyConfig", () => {
    it("should create or update loyalty config", async () => {
      vi.mocked(loyaltyConfigRepository.upsert).mockResolvedValue({
        ...mockConfig,
        pointsPerDollar: new Decimal(2.0),
      });

      const result = await service.upsertLoyaltyConfig("tenant-1", "company-1", {
        pointsPerDollar: 2.0,
        status: "active",
      });

      expect(result.pointsPerDollar).toBe(2.0);
      expect(loyaltyConfigRepository.upsert).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        {
          pointsPerDollar: 2.0,
          status: "active",
        }
      );
    });
  });

  describe("enableLoyalty", () => {
    it("should enable loyalty if config exists", async () => {
      vi.mocked(loyaltyConfigRepository.getByCompanyId).mockResolvedValue(mockConfig);

      await service.enableLoyalty("tenant-1", "company-1");

      expect(loyaltyConfigRepository.setStatus).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        "active"
      );
    });

    it("should create new config if not exists", async () => {
      vi.mocked(loyaltyConfigRepository.getByCompanyId).mockResolvedValue(null);

      await service.enableLoyalty("tenant-1", "company-1");

      expect(loyaltyConfigRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        { status: "active" }
      );
    });
  });

  describe("disableLoyalty", () => {
    it("should disable loyalty", async () => {
      await service.disableLoyalty("tenant-1", "company-1");

      expect(loyaltyConfigRepository.setStatus).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        "inactive"
      );
    });
  });

  describe("setLoyaltyStatus", () => {
    it("should update status if config exists", async () => {
      vi.mocked(loyaltyConfigRepository.getByCompanyId).mockResolvedValue(mockConfig);

      await service.setLoyaltyStatus("tenant-1", "company-1", "inactive");

      expect(loyaltyConfigRepository.setStatus).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        "inactive"
      );
    });

    it("should create config if not exists and status is active", async () => {
      vi.mocked(loyaltyConfigRepository.getByCompanyId).mockResolvedValue(null);

      await service.setLoyaltyStatus("tenant-1", "company-1", "active");

      expect(loyaltyConfigRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        { status: "active" }
      );
    });

    it("should do nothing if config not exists and status is inactive", async () => {
      vi.mocked(loyaltyConfigRepository.getByCompanyId).mockResolvedValue(null);

      await service.setLoyaltyStatus("tenant-1", "company-1", "inactive");

      expect(loyaltyConfigRepository.create).not.toHaveBeenCalled();
      expect(loyaltyConfigRepository.setStatus).not.toHaveBeenCalled();
    });
  });
});
