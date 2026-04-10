import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuEntityRepository } from "../menu-entity.repository";

// Mock crypto.randomUUID
vi.stubGlobal("crypto", {
  randomUUID: vi.fn(() => "mock-uuid"),
});

// Mock Prisma client
vi.mock("@/lib/db", () => ({
  default: {
    menu: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn((queries) => Promise.all(queries)),
  },
}));

import prisma from "@/lib/db";

describe("MenuEntityRepository", () => {
  let repository: MenuEntityRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new MenuEntityRepository();
  });

  describe("createMenu", () => {
    it("should create menu with sortOrder at the end when no sortOrder provided", async () => {
      // Existing menus have sortOrder 0, 1, 2
      vi.mocked(prisma.menu.aggregate).mockResolvedValue({
        _max: { sortOrder: 2 },
        _min: { sortOrder: null },
        _avg: { sortOrder: null },
        _sum: { sortOrder: null },
        _count: { _all: 3 },
      });

      const mockCreatedMenu = {
        id: "mock-uuid",
        tenantId: "tenant-1",
        name: "New Menu",
        description: null,
        sortOrder: 3, // Should be max + 1 = 2 + 1 = 3
        status: "active",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.menu.create).mockResolvedValue(mockCreatedMenu);

      const result = await repository.createMenu("tenant-1", {
        name: "New Menu",
      });

      // Verify aggregate was called to get max sortOrder
      expect(prisma.menu.aggregate).toHaveBeenCalledWith({
        _max: { sortOrder: true },
      });

      // Verify create was called with sortOrder = 3 (max + 1)
      expect(prisma.menu.create).toHaveBeenCalledWith({
        data: {
          id: "mock-uuid",
          tenantId: "tenant-1",
          name: "New Menu",
          description: undefined,
          sortOrder: 3,
        },
      });

      expect(result.sortOrder).toBe(3);
    });

    it("should create first menu with sortOrder 0 when no menus exist", async () => {
      // No existing menus
      vi.mocked(prisma.menu.aggregate).mockResolvedValue({
        _max: { sortOrder: null },
        _min: { sortOrder: null },
        _avg: { sortOrder: null },
        _sum: { sortOrder: null },
        _count: { _all: 0 },
      });

      const mockCreatedMenu = {
        id: "mock-uuid",
        tenantId: "tenant-1",
        name: "First Menu",
        description: null,
        sortOrder: 0,
        status: "active",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.menu.create).mockResolvedValue(mockCreatedMenu);

      await repository.createMenu("tenant-1", {
        name: "First Menu",
      });

      // Verify create was called with sortOrder = 0 (null + 1 with fallback to -1)
      expect(prisma.menu.create).toHaveBeenCalledWith({
        data: {
          id: "mock-uuid",
          tenantId: "tenant-1",
          name: "First Menu",
          description: undefined,
          sortOrder: 0,
        },
      });
    });

    it("should use provided sortOrder when explicitly specified", async () => {
      const mockCreatedMenu = {
        id: "mock-uuid",
        tenantId: "tenant-1",
        name: "Custom Order Menu",
        description: "A menu with custom order",
        sortOrder: 5,
        status: "active",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.menu.create).mockResolvedValue(mockCreatedMenu);

      await repository.createMenu("tenant-1", {
        name: "Custom Order Menu",
        description: "A menu with custom order",
        sortOrder: 5,
      });

      // Should NOT call aggregate when sortOrder is provided
      expect(prisma.menu.aggregate).not.toHaveBeenCalled();

      // Verify create was called with the provided sortOrder
      expect(prisma.menu.create).toHaveBeenCalledWith({
        data: {
          id: "mock-uuid",
          tenantId: "tenant-1",
          name: "Custom Order Menu",
          description: "A menu with custom order",
          sortOrder: 5,
        },
      });
    });

    it("should create menu with description", async () => {
      vi.mocked(prisma.menu.aggregate).mockResolvedValue({
        _max: { sortOrder: 0 },
        _min: { sortOrder: null },
        _avg: { sortOrder: null },
        _sum: { sortOrder: null },
        _count: { _all: 1 },
      });

      const mockCreatedMenu = {
        id: "mock-uuid",
        tenantId: "tenant-1",
        name: "Lunch Menu",
        description: "Available 11am-3pm",
        sortOrder: 1,
        status: "active",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.menu.create).mockResolvedValue(mockCreatedMenu);

      const result = await repository.createMenu("tenant-1", {
        name: "Lunch Menu",
        description: "Available 11am-3pm",
      });

      expect(prisma.menu.create).toHaveBeenCalledWith({
        data: {
          id: "mock-uuid",
          tenantId: "tenant-1",
          name: "Lunch Menu",
          description: "Available 11am-3pm",
          sortOrder: 1,
        },
      });

      expect(result.description).toBe("Available 11am-3pm");
    });
  });

  describe("getMenusByCompany", () => {
    it("should return active menus ordered by sortOrder", async () => {
      const mockMenus = [
        { id: "menu-1", name: "Breakfast", sortOrder: 0, status: "active" },
        { id: "menu-2", name: "Lunch", sortOrder: 1, status: "active" },
        { id: "menu-3", name: "Dinner", sortOrder: 2, status: "active" },
      ];
      vi.mocked(prisma.menu.findMany).mockResolvedValue(mockMenus as never);

      const result = await repository.getMenusByCompany("tenant-1");

      expect(prisma.menu.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          status: "active",
          deleted: false,
        },
        orderBy: {
          sortOrder: "asc",
        },
      });

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("Breakfast");
      expect(result[1].name).toBe("Lunch");
      expect(result[2].name).toBe("Dinner");
    });

    it("should return empty array when no menus exist", async () => {
      vi.mocked(prisma.menu.findMany).mockResolvedValue([]);

      const result = await repository.getMenusByCompany("tenant-1");

      expect(result).toHaveLength(0);
    });
  });

  describe("getMenusByCompanyForDashboard", () => {
    it("should return all menus including inactive", async () => {
      const mockMenus = [
        { id: "menu-1", name: "Active Menu", sortOrder: 0, status: "active" },
        { id: "menu-2", name: "Inactive Menu", sortOrder: 1, status: "inactive" },
      ];
      vi.mocked(prisma.menu.findMany).mockResolvedValue(mockMenus as never);

      const result = await repository.getMenusByCompanyForDashboard(
        "tenant-1"
      );

      expect(prisma.menu.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          deleted: false,
        },
        orderBy: {
          sortOrder: "asc",
        },
      });

      expect(result).toHaveLength(2);
    });
  });

  describe("updateMenuSortOrders", () => {
    it("should batch update sort orders in a transaction", async () => {
      const updates = [
        { id: "menu-1", sortOrder: 2 },
        { id: "menu-2", sortOrder: 0 },
        { id: "menu-3", sortOrder: 1 },
      ];

      vi.mocked(prisma.menu.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.$transaction).mockImplementation(((queries: unknown[]) =>
        Promise.all(queries)
      ) as unknown as typeof prisma.$transaction);

      await repository.updateMenuSortOrders("tenant-1", updates);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.menu.updateMany).toHaveBeenCalledTimes(3);

      expect(prisma.menu.updateMany).toHaveBeenCalledWith({
        where: { id: "menu-1", tenantId: "tenant-1" },
        data: { sortOrder: 2 },
      });
      expect(prisma.menu.updateMany).toHaveBeenCalledWith({
        where: { id: "menu-2", tenantId: "tenant-1" },
        data: { sortOrder: 0 },
      });
      expect(prisma.menu.updateMany).toHaveBeenCalledWith({
        where: { id: "menu-3", tenantId: "tenant-1" },
        data: { sortOrder: 1 },
      });
    });
  });

  describe("countMenusByCompany", () => {
    it("should count only active menus", async () => {
      vi.mocked(prisma.menu.count).mockResolvedValue(3);

      const result = await repository.countMenusByCompany("tenant-1");

      expect(prisma.menu.count).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          status: "active",
          deleted: false,
        },
      });

      expect(result).toBe(3);
    });
  });

  describe("getMenuById", () => {
    it("should find menu by ID", async () => {
      vi.mocked(prisma.menu.findFirst).mockResolvedValue({
        id: "menu-1",
        name: "Lunch",
      } as never);

      const result = await repository.getMenuById("tenant-1", "menu-1");

      expect(prisma.menu.findFirst).toHaveBeenCalledWith({
        where: { id: "menu-1", tenantId: "tenant-1", deleted: false },
      });
      expect(result).toEqual({ id: "menu-1", name: "Lunch" });
    });
  });

  describe("getMenuWithCategories", () => {
    it("should find menu with categories", async () => {
      vi.mocked(prisma.menu.findFirst).mockResolvedValue({
        id: "menu-1",
        categories: [{ id: "cat-1", name: "Appetizers" }],
      } as never);

      const result = await repository.getMenuWithCategories("tenant-1", "menu-1");

      expect(prisma.menu.findFirst).toHaveBeenCalledWith({
        where: { id: "menu-1", tenantId: "tenant-1", deleted: false },
        include: {
          categories: {
            where: { deleted: false },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
      expect(result).toBeTruthy();
    });
  });

  describe("updateMenu", () => {
    it("should update menu by ID", async () => {
      vi.mocked(prisma.menu.updateMany).mockResolvedValue({ count: 1 });

      await repository.updateMenu("tenant-1", "menu-1", { name: "Updated Menu" });

      expect(prisma.menu.updateMany).toHaveBeenCalledWith({
        where: { id: "menu-1", tenantId: "tenant-1" },
        data: { name: "Updated Menu" },
      });
    });
  });

  describe("hardDeleteMenu", () => {
    it("should soft delete (set deleted flag) a menu", async () => {
      vi.mocked(prisma.menu.updateMany).mockResolvedValue({ count: 1 });

      await repository.hardDeleteMenu("tenant-1", "menu-1");

      expect(prisma.menu.updateMany).toHaveBeenCalledWith({
        where: { id: "menu-1", tenantId: "tenant-1" },
        data: { deleted: true, updatedAt: expect.any(Date) },
      });
    });
  });

  describe("deleteMenu", () => {
    it("should soft delete by setting status to inactive", async () => {
      vi.mocked(prisma.menu.updateMany).mockResolvedValue({ count: 1 });

      await repository.deleteMenu("tenant-1", "menu-1");

      expect(prisma.menu.updateMany).toHaveBeenCalledWith({
        where: {
          id: "menu-1",
          tenantId: "tenant-1",
        },
        data: {
          status: "inactive",
          deleted: true,
          updatedAt: expect.any(Date),
        },
      });
    });
  });
});
