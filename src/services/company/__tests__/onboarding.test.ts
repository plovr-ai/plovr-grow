import { describe, it, expect, vi, beforeEach } from "vitest";
import { CompanyService } from "../company.service";
import type { OnboardingData } from "@/types/onboarding";

vi.mock("@/repositories/company.repository", () => ({
  companyRepository: {
    getById: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/repositories/merchant.repository", () => ({
  merchantRepository: {},
}));

vi.mock("@/lib/db", () => ({ default: {} }));

import { companyRepository } from "@/repositories/company.repository";

const mockRepo = vi.mocked(companyRepository);

describe("CompanyService onboarding", () => {
  let service: CompanyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CompanyService();
  });

  describe("initializeOnboarding", () => {
    it("initializes with default data for new user", async () => {
      mockRepo.getById.mockResolvedValue({
        id: "c1",
        onboardingStatus: "not_started",
        onboardingData: null,
        source: null,
      } as never);
      mockRepo.update.mockResolvedValue({} as never);

      await service.initializeOnboarding("c1");

      expect(mockRepo.update).toHaveBeenCalledWith("c1", {
        onboardingStatus: "in_progress",
        onboardingData: expect.objectContaining({
          steps: expect.objectContaining({
            website: { status: "pending" },
            gbp: { status: "locked" },
            menu: { status: "locked" },
            stripe: { status: "locked" },
          }),
        }),
      });
    });

    it("initializes with website completed for claimed user", async () => {
      mockRepo.getById.mockResolvedValue({
        id: "c1",
        onboardingStatus: "not_started",
        onboardingData: null,
        source: "generator",
        merchants: [{ id: "m1" }],
      } as never);
      mockRepo.update.mockResolvedValue({} as never);

      await service.initializeOnboarding("c1");

      const updateCall = mockRepo.update.mock.calls[0][1];
      const data = updateCall.onboardingData as unknown as OnboardingData;
      expect(data.steps.website.status).toBe("completed");
      expect(data.steps.gbp.status).toBe("pending");
      expect(data.steps.menu.status).toBe("pending");
      expect(data.steps.stripe.status).toBe("pending");
    });

    it("does nothing if already in progress", async () => {
      mockRepo.getById.mockResolvedValue({
        id: "c1",
        onboardingStatus: "in_progress",
        onboardingData: { steps: {} },
      } as never);

      await service.initializeOnboarding("c1");

      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("updateOnboardingStep", () => {
    const baseData: OnboardingData = {
      steps: {
        website: { status: "pending" },
        gbp: { status: "locked" },
        menu: { status: "locked" },
        stripe: { status: "locked" },
      },
    };

    it("completing website unlocks gbp, menu, stripe", async () => {
      mockRepo.getById.mockResolvedValue({
        id: "c1",
        onboardingStatus: "in_progress",
        onboardingData: baseData,
      } as never);
      mockRepo.update.mockResolvedValue({} as never);

      await service.updateOnboardingStep("c1", "website", "completed");

      const updateCall = mockRepo.update.mock.calls[0][1];
      const data = updateCall.onboardingData as unknown as OnboardingData;
      expect(data.steps.website.status).toBe("completed");
      expect(data.steps.website.completedAt).toBeDefined();
      expect(data.steps.gbp.status).toBe("pending");
      expect(data.steps.menu.status).toBe("pending");
      expect(data.steps.stripe.status).toBe("pending");
    });

    it("skipping a step records skipped status", async () => {
      const data: OnboardingData = {
        steps: {
          website: { status: "completed", completedAt: "2026-01-01" },
          gbp: { status: "pending" },
          menu: { status: "pending" },
          stripe: { status: "pending" },
        },
      };
      mockRepo.getById.mockResolvedValue({
        id: "c1",
        onboardingStatus: "in_progress",
        onboardingData: data,
      } as never);
      mockRepo.update.mockResolvedValue({} as never);

      await service.updateOnboardingStep("c1", "gbp", "skipped");

      const updateCall = mockRepo.update.mock.calls[0][1];
      const updated = updateCall.onboardingData as unknown as OnboardingData;
      expect(updated.steps.gbp.status).toBe("skipped");
      expect(updated.steps.gbp.completedAt).toBeDefined();
    });

    it("auto-completes onboarding when all steps done", async () => {
      const data: OnboardingData = {
        steps: {
          website: { status: "completed", completedAt: "2026-01-01" },
          gbp: { status: "completed", completedAt: "2026-01-01" },
          menu: { status: "skipped", completedAt: "2026-01-01" },
          stripe: { status: "pending" },
        },
      };
      mockRepo.getById.mockResolvedValue({
        id: "c1",
        onboardingStatus: "in_progress",
        onboardingData: data,
      } as never);
      mockRepo.update.mockResolvedValue({} as never);

      await service.updateOnboardingStep("c1", "stripe", "completed");

      const updateCall = mockRepo.update.mock.calls[0][1];
      expect(updateCall.onboardingStatus).toBe("completed");
      expect(updateCall.onboardingCompletedAt).toBeInstanceOf(Date);
    });
  });
});
