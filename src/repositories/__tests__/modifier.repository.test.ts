import { describe, it, expect, vi, beforeEach } from "vitest";

// Minimal prisma mock — modifier.repository.ts only touches findUnique +
// updateMany on two models.
const mockPrisma = vi.hoisted(() => ({
  modifierOption: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  modifierGroup: {
    updateMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));

import { ModifierRepository } from "../modifier.repository";

describe("ModifierRepository", () => {
  let repo: ModifierRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ModifierRepository();
  });

  describe("getOptionGroupId()", () => {
    it("should return the groupId when the option exists", async () => {
      mockPrisma.modifierOption.findUnique.mockResolvedValue({
        groupId: "grp-1",
      } as never);

      const result = await repo.getOptionGroupId("opt-1");

      expect(mockPrisma.modifierOption.findUnique).toHaveBeenCalledWith({
        where: { id: "opt-1" },
        select: { groupId: true },
      });
      expect(result).toBe("grp-1");
    });

    it("should return null when the option does not exist", async () => {
      mockPrisma.modifierOption.findUnique.mockResolvedValue(null);

      const result = await repo.getOptionGroupId("opt-missing");

      expect(result).toBeNull();
    });

    it("should use the provided tx client when one is passed", async () => {
      const txFindUnique = vi
        .fn()
        .mockResolvedValue({ groupId: "grp-tx" } as never);
      const tx = { modifierOption: { findUnique: txFindUnique } } as never;

      const result = await repo.getOptionGroupId("opt-1", tx);

      expect(txFindUnique).toHaveBeenCalled();
      expect(mockPrisma.modifierOption.findUnique).not.toHaveBeenCalled();
      expect(result).toBe("grp-tx");
    });
  });

  describe("softDeleteGroup()", () => {
    it("should soft-delete a modifier group scoped by tenant", async () => {
      mockPrisma.modifierGroup.updateMany.mockResolvedValue({
        count: 1,
      } as never);

      await repo.softDeleteGroup("t1", "grp-1");

      expect(mockPrisma.modifierGroup.updateMany).toHaveBeenCalledWith({
        where: { id: "grp-1", tenantId: "t1" },
        data: { deleted: true },
      });
    });

    it("should use the provided tx client when one is passed", async () => {
      const txUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const tx = {
        modifierGroup: { updateMany: txUpdateMany },
      } as never;

      await repo.softDeleteGroup("t1", "grp-1", tx);

      expect(txUpdateMany).toHaveBeenCalledWith({
        where: { id: "grp-1", tenantId: "t1" },
        data: { deleted: true },
      });
      expect(mockPrisma.modifierGroup.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("softDeleteOptionsByGroup()", () => {
    it("should soft-delete every option belonging to a group", async () => {
      mockPrisma.modifierOption.updateMany.mockResolvedValue({
        count: 2,
      } as never);

      await repo.softDeleteOptionsByGroup("grp-1");

      expect(mockPrisma.modifierOption.updateMany).toHaveBeenCalledWith({
        where: { groupId: "grp-1" },
        data: { deleted: true },
      });
    });

    it("should use the provided tx client when one is passed", async () => {
      const txUpdateMany = vi.fn().mockResolvedValue({ count: 2 });
      const tx = {
        modifierOption: { updateMany: txUpdateMany },
      } as never;

      await repo.softDeleteOptionsByGroup("grp-1", tx);

      expect(txUpdateMany).toHaveBeenCalledWith({
        where: { groupId: "grp-1" },
        data: { deleted: true },
      });
      expect(mockPrisma.modifierOption.updateMany).not.toHaveBeenCalled();
    });
  });
});
