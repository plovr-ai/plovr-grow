import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/repositories/lead.repository", () => ({
  leadRepository: {
    create: vi.fn(),
  },
}));

import { leadsService } from "../leads.service";
import { leadRepository } from "@/repositories/lead.repository";

describe("LeadsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createCalculatorLead forwards the payload unchanged", async () => {
    vi.mocked(leadRepository.create).mockResolvedValue({ id: "lead-1" } as never);

    const input = {
      email: "a@b.com",
      revenue: 10000,
      aov: 25,
      platform: "doordash" as const,
      monthlyLoss: 500,
      source: "calculator" as const,
    };

    const result = await leadsService.createCalculatorLead(input);
    expect(result).toEqual({ id: "lead-1" });
    expect(leadRepository.create).toHaveBeenCalledWith(input);
  });

  it("createDemoLead stamps source='landing-page'", async () => {
    vi.mocked(leadRepository.create).mockResolvedValue({ id: "lead-2" } as never);

    const input = {
      restaurantName: "Joe's",
      email: "owner@joes.com",
      firstName: "Joe",
      phone: "555-0100",
    };

    await leadsService.createDemoLead(input);

    expect(leadRepository.create).toHaveBeenCalledWith({
      ...input,
      source: "landing-page",
    });
  });
});
