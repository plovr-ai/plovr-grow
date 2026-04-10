import { describe, it, expect, vi, beforeEach } from "vitest";
import NewMenuItemPage from "../page";

// Create a custom error to simulate Next.js redirect behavior
class RedirectError extends Error {
  url: string;
  constructor(url: string) {
    super(`NEXT_REDIRECT: ${url}`);
    this.url = url;
  }
}

// Mock next/navigation - redirect throws to stop execution
const mockRedirect = vi.fn((url: string) => {
  throw new RedirectError(url);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
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

describe("NewMenuItemPage", () => {
  const mockSession = {
    user: {
      tenantId: "tenant-1",    },
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
        menuItems: [],
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
        NewMenuItemPage({
          searchParams: Promise.resolve({ menuId: "menu-1", categoryId: "cat-1" }),
        })
      ).rejects.toThrow("NEXT_REDIRECT: /dashboard/login");

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/login");
    });

    it("should redirect to login when session missing tenantId", async () => {
      mockAuth.mockResolvedValue({ user: {} });

      await expect(
        NewMenuItemPage({
          searchParams: Promise.resolve({ menuId: "menu-1", categoryId: "cat-1" }),
        })
      ).rejects.toThrow("NEXT_REDIRECT: /dashboard/login");

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/login");
    });

    it("should not redirect when session has tenantId", async () => {
      mockAuth.mockResolvedValue({ user: { tenantId: "tenant-1" } });

      const result = await NewMenuItemPage({
        searchParams: Promise.resolve({ menuId: "menu-1", categoryId: "cat-1" }),
      });

      expect(result).toBeDefined();
    });
  });

  describe("Category validation", () => {
    it("should redirect to /dashboard/menu when categoryId is missing", async () => {
      await expect(
        NewMenuItemPage({
          searchParams: Promise.resolve({ menuId: "menu-1" }),
        })
      ).rejects.toThrow("NEXT_REDIRECT: /dashboard/menu");

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/menu");
    });

    it("should redirect to /dashboard/menu when category not found", async () => {
      await expect(
        NewMenuItemPage({
          searchParams: Promise.resolve({ menuId: "menu-1", categoryId: "non-existent" }),
        })
      ).rejects.toThrow("NEXT_REDIRECT: /dashboard/menu");

      expect(mockRedirect).toHaveBeenCalledWith("/dashboard/menu");
    });
  });

  describe("Menu ID handling", () => {
    it("should pass menuId to getMenuForDashboard", async () => {
      const result = await NewMenuItemPage({
        searchParams: Promise.resolve({ menuId: "menu-2", categoryId: "cat-1" }),
      });

      expect(mockGetMenuForDashboard).toHaveBeenCalledWith(
        "tenant-1",
        "menu-2"
      );
      expect(result).toBeDefined();
    });

    it("should pass undefined menuId when not provided", async () => {
      const result = await NewMenuItemPage({
        searchParams: Promise.resolve({ categoryId: "cat-1" }),
      });

      expect(mockGetMenuForDashboard).toHaveBeenCalledWith(
        "tenant-1",
        undefined
      );
      expect(result).toBeDefined();
    });
  });

  describe("Successful render", () => {
    it("should return JSX when all validations pass", async () => {
      const result = await NewMenuItemPage({
        searchParams: Promise.resolve({ menuId: "menu-1", categoryId: "cat-1" }),
      });

      expect(result).toBeDefined();
      expect(mockGetMenuForDashboard).toHaveBeenCalled();
      expect(mockGetTaxConfigs).toHaveBeenCalled();
    });

    it("should fetch tax configs", async () => {
      await NewMenuItemPage({
        searchParams: Promise.resolve({ menuId: "menu-1", categoryId: "cat-1" }),
      });

      expect(mockGetTaxConfigs).toHaveBeenCalledWith("tenant-1");
    });
  });
});
