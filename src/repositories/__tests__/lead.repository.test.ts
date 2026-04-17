import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeadRepository } from "../lead.repository";

vi.mock("@/lib/db", () => ({
  default: {
    lead: {
      create: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db";

describe("LeadRepository", () => {
  let repository: LeadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new LeadRepository();
  });

  it("forwards the data to prisma.lead.create", async () => {
    const created = { id: "lead-generated-id", email: "a@b.com" };
    vi.mocked(prisma.lead.create).mockResolvedValue(created as never);

    const result = await repository.create({
      email: "a@b.com",
      revenue: 1000,
      aov: 20,
      platform: "doordash",
      monthlyLoss: 100,
      source: "calculator",
    });

    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: {
        email: "a@b.com",
        revenue: 1000,
        aov: 20,
        platform: "doordash",
        monthlyLoss: 100,
        source: "calculator",
      },
    });
    expect(result).toEqual(created);
  });
});
