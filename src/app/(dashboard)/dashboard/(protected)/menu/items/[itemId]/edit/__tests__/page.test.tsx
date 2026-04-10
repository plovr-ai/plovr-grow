import { describe, it, expect, vi, beforeEach } from "vitest";
import EditMenuItemPage from "../page";

// Create a custom error to simulate Next.js redirect behavior
class RedirectError extends Error {
  url: string;
  constructor(url: string) {
    super(`NEXT_REDIRECT: ${url}`);
    this.url = url;
  }
}

// Create a custom error to simulate Next.js notFound behavior
class NotFoundError extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}

// Mock next/navigation
const mockRedirect = vi.fn((url: string) => {
  throw new RedirectError(url);
});

const mockNotFound = vi.fn(() => {
  throw new NotFoundError();
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  notFound: () => mockNotFound(),
}));

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock services
const mockGetMenuForDashboard = vi.fn();
const mockGetTaxConfigs = vi.fn();

vi.mock("@/services/menu/menu.service", () => ({
  menuService: {
    getMenuForDashboard: (...args: unknown[]) => mockGetMenuForDashboard(...args),
  },
}));

vi.mock("@/services/menu/tax-config.service", () => ({
  taxConfigService: {
    getTaxConfigs: (...args: unknown[]) => mockGetTaxConfigs(...args),
  },
}));

// Mock MenuItemFormPage component
vi.mock("@/components/dashboard/menu/MenuItemFormPage", () => ({
  MenuItemFormPage: () => <div data-testid="menu-item-form">Form</div>,
}));

describe("EditMenuItemPage", () => {
  const mockSession = {
    user: {
      tenantId: "tenant-1",    },
  };

  const mockMenuItem = {
    id: "item-1",
    name: "Spring Rolls",
    description: "Crispy spring rolls",
    price: 8.99,
    imageUrl: null,
    sortOrder: 0,
    status: "active",
    modifierGroups: [],
    tags: [],
    taxConfigIds: [],
  };

  const mockMenuData = {
    menus: [{ id: "menu-1", name: "Main Menu" }],
    currentMenuId: "menu-1",
    categories: [
      {
        id: "cat-1",
        name: "Appetizers",
        description: null,
        imageUrl: null,
        sortOrder: 0,
        status: "active",
        menuItems: [mockMenuItem],
      },
      {
        id: "cat-2",
        name: "Main Dishes",
        description: null,
        imageUrl: null,
        sortOrder: 1,
        status: "active",
        menuItems: [],
      },
    ],
  };

  const mockTaxConfigs = [
    { id: "tax-1", name: "Standard Tax", description: "8.25%" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(mockSession);
    mockGetMenuForDashboard.mockResolvedValue(mockMenuData);
    mockGetTaxConfigs.mockResolvedValue(mockTaxConfigs);
  });

  describe("Authentication", () => {
    it("should redirect to login when no session", async () => {
      mockAuth.mockResolvedValue(null);

      await expect(
        EditMenuItemPage({
          params: Promise.resolve({ itemId: "item-1" }),
          searchParams: Promise.resolve({ menuId: "menu-1" }),
        })
      ).rejects.toThrow("NEXT_REDIRECT: /dashboard/login");

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/login");
    });

    it("should redirect to login when session missing tenantId", async () => {
      mockAuth.mockResolvedValue({ user: {} });

      await expect(
        EditMenuItemPage({
          params: Promise.resolve({ itemId: "item-1" }),
          searchParams: Promise.resolve({ menuId: "menu-1" }),
        })
      ).rejects.toThrow("NEXT_REDIRECT: /dashboard/login");

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/login");
    });
  });

  describe("Item validation", () => {
    it("should return notFound when item not found", async () => {
      await expect(
        EditMenuItemPage({
          params: Promise.resolve({ itemId: "non-existent" }),
          searchParams: Promise.resolve({ menuId: "menu-1" }),
        })
      ).rejects.toThrow("NEXT_NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalled();
    });
  });

  describe("Menu ID handling", () => {
    it("should pass menuId to getMenuForDashboard", async () => {
      const result = await EditMenuItemPage({
        params: Promise.resolve({ itemId: "item-1" }),
        searchParams: Promise.resolve({ menuId: "menu-2" }),
      });

      expect(mockGetMenuForDashboard).toHaveBeenCalledWith(
        "tenant-1",
        "menu-2"
      );
      expect(result).toBeDefined();
    });

    it("should pass undefined menuId when not provided", async () => {
      const result = await EditMenuItemPage({
        params: Promise.resolve({ itemId: "item-1" }),
        searchParams: Promise.resolve({}),
      });

      expect(mockGetMenuForDashboard).toHaveBeenCalledWith(
        "tenant-1",
        undefined
      );
      expect(result).toBeDefined();
    });
  });

  describe("Successful render", () => {
    it("should return JSX when item is found", async () => {
      const result = await EditMenuItemPage({
        params: Promise.resolve({ itemId: "item-1" }),
        searchParams: Promise.resolve({ menuId: "menu-1" }),
      });

      expect(result).toBeDefined();
      expect(mockGetMenuForDashboard).toHaveBeenCalled();
      expect(mockGetTaxConfigs).toHaveBeenCalled();
    });

    it("should fetch tax configs", async () => {
      await EditMenuItemPage({
        params: Promise.resolve({ itemId: "item-1" }),
        searchParams: Promise.resolve({ menuId: "menu-1" }),
      });

      expect(mockGetTaxConfigs).toHaveBeenCalledWith("tenant-1");
    });
  });
});
