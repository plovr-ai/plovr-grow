/**
 * Cart Service Integration Test
 *
 * Verifies the CartService lifecycle with a real MySQL database:
 * 1. Full lifecycle: create -> add items -> update -> remove -> checkout
 * 2. Status constraints: submitted/cancelled carts reject mutations
 * 3. Tenant isolation: cart not visible across tenants
 * 4. Menu item validation: nonexistent menu item rejected
 *
 * Uses real MySQL database with mocked external dependencies.
 *
 * Run with: npx vitest run --config vitest.config.integration.ts src/services/cart
 * Requires: MySQL running with DATABASE_URL configured
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { generateEntityId } from "@/lib/id";

// ---------------------------------------------------------------------------
// Mock external dependencies BEFORE importing any service modules
// ---------------------------------------------------------------------------

// Mock menuService (used by orderService during checkout)
const mockGetMenuItemsByIds = vi.fn();
vi.mock("@/services/menu", () => ({
  menuService: {
    getMenuItemsByIds: (...args: unknown[]) => mockGetMenuItemsByIds(...args),
  },
}));

// Mock merchantService (used by orderService during checkout)
const mockGetMerchantById = vi.fn();
vi.mock("@/services/merchant", () => ({
  merchantService: {
    getMerchantById: (...args: unknown[]) => mockGetMerchantById(...args),
  },
}));

// Mock taxConfigRepository (used by orderService during checkout)
const mockGetMenuItemsTaxConfigIds = vi.fn();
const mockGetTaxConfigsByIds = vi.fn();
const mockGetMerchantTaxRateMap = vi.fn();
vi.mock("@/repositories/tax-config.repository", () => ({
  taxConfigRepository: {
    getMenuItemsTaxConfigIds: (...args: unknown[]) =>
      mockGetMenuItemsTaxConfigIds(...args),
    getTaxConfigsByIds: (...args: unknown[]) =>
      mockGetTaxConfigsByIds(...args),
    getMerchantTaxRateMap: (...args: unknown[]) =>
      mockGetMerchantTaxRateMap(...args),
  },
}));

// Mock sequenceRepository (used by orderService during checkout)
const mockGetNextOrderSequence = vi.fn();
vi.mock("@/repositories/sequence.repository", () => ({
  sequenceRepository: {
    getNextOrderSequence: (...args: unknown[]) =>
      mockGetNextOrderSequence(...args),
  },
}));

// Mock giftCardService (used by createMerchantOrderAtomic)
vi.mock("@/services/giftcard", () => ({
  giftCardService: {
    redeemGiftCard: vi.fn(),
  },
}));

// Mock paymentService (used by createMerchantOrderAtomic)
vi.mock("@/services/payment", () => ({
  paymentService: {
    createPaymentRecord: vi.fn(),
  },
}));

// Mock POS provider registry (order-listener may fire on order.paid)
vi.mock("@/services/integration/pos-provider-registry", () => ({
  posProviderRegistry: {
    getProvider: () => ({
      type: "POS_SQUARE",
      pushOrder: vi.fn(),
      updateFulfillment: vi.fn(),
      cancelOrder: vi.fn(),
    }),
  },
}));

// Mock squareService
vi.mock("@/services/square/square.service", () => ({
  squareService: {
    syncCatalog: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Real PrismaClient + override @/lib/db for repository code
// ---------------------------------------------------------------------------

const prisma = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.hoisted requires synchronous require
  const { PrismaClient: PC } = require("@prisma/client") as typeof import("@prisma/client");
  const url =
    process.env.DATABASE_URL ||
    "mysql://root:password@localhost:3306/plovr_test";
  return new PC({ datasources: { db: { url } } });
});

vi.mock("@/lib/db", () => ({
  default: prisma,
  __esModule: true,
}));

// ---------------------------------------------------------------------------
// Import real services AFTER mocks are set up
// ---------------------------------------------------------------------------

import { CartService } from "@/services/cart/cart.service";

// ---------------------------------------------------------------------------
// Test IDs (stable across tests, unique per run)
// ---------------------------------------------------------------------------

const TENANT_ID = generateEntityId();
const TENANT_B_ID = generateEntityId();
const MERCHANT_ID = generateEntityId();
const MENU_ID = generateEntityId();
const CATEGORY_ID = generateEntityId();
const CATEGORY_ITEM_ID = generateEntityId();
const CATEGORY_ITEM_ID_2 = generateEntityId();
const MENU_ITEM_ID = generateEntityId();
const MENU_ITEM_ID_2 = generateEntityId();

const MERCHANT_TIMEZONE = "America/Los_Angeles";

// ---------------------------------------------------------------------------
// Seed & cleanup
// ---------------------------------------------------------------------------

async function seedTestData() {
  // Two tenants for isolation test
  await prisma.tenant.createMany({
    data: [
      {
        id: TENANT_ID,
        name: "Cart Test Tenant",
        slug: `cart-tenant-${Date.now()}`,
      },
      {
        id: TENANT_B_ID,
        name: "Cart Test Tenant B",
        slug: `cart-tenant-b-${Date.now()}`,
      },
    ],
  });

  await prisma.merchant.create({
    data: {
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      slug: `cart-merchant-${Date.now()}`,
      name: "Cart Test Merchant",
      timezone: MERCHANT_TIMEZONE,
    },
  });

  // Menu hierarchy so real menuRepository can find items
  await prisma.menu.create({
    data: {
      id: MENU_ID,
      tenantId: TENANT_ID,
      name: "Cart Test Menu",
    },
  });

  await prisma.menuCategory.create({
    data: {
      id: CATEGORY_ID,
      tenantId: TENANT_ID,
      menuId: MENU_ID,
      name: "Cart Test Category",
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        id: MENU_ITEM_ID,
        tenantId: TENANT_ID,
        name: "Test Burger",
        price: 12.99,
      },
      {
        id: MENU_ITEM_ID_2,
        tenantId: TENANT_ID,
        name: "Test Fries",
        price: 4.99,
      },
    ],
  });

  await prisma.menuCategoryItem.createMany({
    data: [
      {
        id: CATEGORY_ITEM_ID,
        tenantId: TENANT_ID,
        categoryId: CATEGORY_ID,
        menuItemId: MENU_ITEM_ID,
      },
      {
        id: CATEGORY_ITEM_ID_2,
        tenantId: TENANT_ID,
        categoryId: CATEGORY_ID,
        menuItemId: MENU_ITEM_ID_2,
      },
    ],
  });
}

async function cleanupTestData() {
  // Delete in reverse FK dependency order
  // Order-related tables (created during checkout) — use try/catch for tables
  // that may not exist in every database setup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model types are complex, using any for cleanup helper
  const safeDeleteMany = async (fn: () => Promise<any>) => {
    try {
      await fn();
    } catch {
      // Table may not exist — ignore
    }
  };

  await safeDeleteMany(() => prisma.fulfillmentStatusLog.deleteMany({ where: { tenantId: TENANT_ID } }));
  await safeDeleteMany(() => prisma.orderFulfillment.deleteMany({ where: { tenantId: TENANT_ID } }));
  await safeDeleteMany(() => prisma.payment.deleteMany({ where: { tenantId: TENANT_ID } }));
  await safeDeleteMany(() => prisma.orderItemModifier.deleteMany({ where: { orderItem: { order: { tenantId: TENANT_ID } } } }));
  await safeDeleteMany(() => prisma.orderItem.deleteMany({ where: { order: { tenantId: TENANT_ID } } }));
  await safeDeleteMany(() => prisma.order.deleteMany({ where: { tenantId: TENANT_ID } }));
  await safeDeleteMany(() => prisma.orderSequence.deleteMany({ where: { tenantId: TENANT_ID } }));

  // Cart tables
  await safeDeleteMany(() => prisma.cartItemModifier.deleteMany({ where: { cartItem: { cart: { tenantId: TENANT_ID } } } }));
  await safeDeleteMany(() => prisma.cartItem.deleteMany({ where: { cart: { tenantId: TENANT_ID } } }));
  await safeDeleteMany(() => prisma.cart.deleteMany({ where: { tenantId: TENANT_ID } }));
  await safeDeleteMany(() => prisma.cart.deleteMany({ where: { tenantId: TENANT_B_ID } }));

  // Menu tables
  await safeDeleteMany(() => prisma.menuCategoryItem.deleteMany({ where: { tenantId: TENANT_ID } }));
  await safeDeleteMany(() => prisma.menuItem.deleteMany({ where: { tenantId: TENANT_ID } }));
  await safeDeleteMany(() => prisma.menuCategory.deleteMany({ where: { tenantId: TENANT_ID } }));
  await safeDeleteMany(() => prisma.menu.deleteMany({ where: { tenantId: TENANT_ID } }));

  // Merchant & Tenant
  await safeDeleteMany(() => prisma.merchant.deleteMany({ where: { tenantId: TENANT_ID } }));
  await safeDeleteMany(() => prisma.tenant.deleteMany({ where: { id: { in: [TENANT_ID, TENANT_B_ID] } } }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Setup mocks for orderService.createMerchantOrderAtomic (called during checkout).
 */
function setupOrderCreationMocks(sequenceNum = 1) {
  const allItems = [
    {
      id: MENU_ITEM_ID,
      name: "Test Burger",
      price: 12.99,
      taxConfigId: null,
      status: "active",
    },
    {
      id: MENU_ITEM_ID_2,
      name: "Test Fries",
      price: 4.99,
      taxConfigId: null,
      status: "active",
    },
  ];
  // Return only the items whose IDs were requested (3rd arg is the ID array)
  mockGetMenuItemsByIds.mockImplementation(
    (_tenantId: string, _merchantId: string, ids: string[]) =>
      Promise.resolve(allItems.filter((item) => ids.includes(item.id)))
  );
  mockGetNextOrderSequence.mockResolvedValue(sequenceNum);
  mockGetMenuItemsTaxConfigIds.mockResolvedValue(new Map());
  mockGetTaxConfigsByIds.mockResolvedValue([]);
  mockGetMerchantTaxRateMap.mockResolvedValue(new Map());
  mockGetMerchantById.mockResolvedValue({
    id: MERCHANT_ID,
    tenantId: TENANT_ID,
    timezone: MERCHANT_TIMEZONE,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CartService Integration", () => {
  const cartService = new CartService();

  beforeAll(async () => {
    await cleanupTestData();
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Full lifecycle
  // =========================================================================
  describe("Full lifecycle: create -> add items -> update -> remove -> checkout", () => {
    let cartId: string;
    let item1Id: string;
    let item2Id: string;

    it("creates a cart", async () => {
      const cart = await cartService.createCart(TENANT_ID, MERCHANT_ID, {
        salesChannel: "phone_order",
      });

      cartId = cart.id;
      expect(cart.tenantId).toBe(TENANT_ID);
      expect(cart.merchantId).toBe(MERCHANT_ID);
      expect(cart.status).toBe("active");
      expect(cart.salesChannel).toBe("phone_order");
    });

    it("adds 2 items to the cart", async () => {
      const cart1 = await cartService.addItem(TENANT_ID, cartId, {
        menuItemId: MENU_ITEM_ID,
        quantity: 1,
      });

      expect(cart1.items).toHaveLength(1);
      const addedItem1 = cart1.items[0];
      item1Id = addedItem1.id;
      expect(addedItem1.name).toBe("Test Burger");
      expect(addedItem1.unitPrice).toBeCloseTo(12.99, 2);
      expect(addedItem1.quantity).toBe(1);
      expect(addedItem1.totalPrice).toBeCloseTo(12.99, 2);

      const cart2 = await cartService.addItem(TENANT_ID, cartId, {
        menuItemId: MENU_ITEM_ID_2,
        quantity: 2,
      });

      expect(cart2.items).toHaveLength(2);
      const addedItem2 = cart2.items.find((i) => i.menuItemId === MENU_ITEM_ID_2)!;
      item2Id = addedItem2.id;
      expect(addedItem2.name).toBe("Test Fries");
      expect(addedItem2.unitPrice).toBeCloseTo(4.99, 2);
      expect(addedItem2.quantity).toBe(2);
      expect(addedItem2.totalPrice).toBeCloseTo(9.98, 2);
    });

    it("updates item quantity", async () => {
      const updated = await cartService.updateItem(
        TENANT_ID,
        cartId,
        item1Id,
        { quantity: 3 }
      );

      const updatedItem = updated.items.find((i) => i.id === item1Id)!;
      expect(updatedItem.quantity).toBe(3);
      expect(updatedItem.totalPrice).toBeCloseTo(38.97, 2);
    });

    it("removes 1 item", async () => {
      await cartService.removeItem(TENANT_ID, cartId, item2Id);

      const cart = await cartService.getCart(TENANT_ID, cartId);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].id).toBe(item1Id);
    });

    it("gets cart and verifies 1 item remains", async () => {
      const cart = await cartService.getCart(TENANT_ID, cartId);

      expect(cart.id).toBe(cartId);
      expect(cart.status).toBe("active");
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].menuItemId).toBe(MENU_ITEM_ID);
      expect(cart.items[0].quantity).toBe(3);
    });

    it("checks out cart and verifies order created + cart status is submitted", async () => {
      setupOrderCreationMocks(1);

      const result = await cartService.checkout(TENANT_ID, cartId, {
        customerFirstName: "Test",
        customerLastName: "User",
        customerPhone: "555-0100",
        customerEmail: "test@example.com",
        orderMode: "pickup",
      });

      expect(result.orderId).toBeDefined();
      expect(result.orderNumber).toBeDefined();

      // Verify order exists in DB
      const dbOrder = await prisma.order.findUnique({
        where: { id: result.orderId },
      });
      expect(dbOrder).not.toBeNull();
      expect(dbOrder!.tenantId).toBe(TENANT_ID);
      expect(dbOrder!.merchantId).toBe(MERCHANT_ID);

      // Verify cart status is now submitted
      const cart = await cartService.getCart(TENANT_ID, cartId);
      expect(cart.status).toBe("submitted");
    });
  });

  // =========================================================================
  // 2. Status constraints
  // =========================================================================
  describe("Status constraints", () => {
    it("submitted cart rejects addItem with CART_NOT_ACTIVE", async () => {
      // Create + submit a cart
      setupOrderCreationMocks(2);

      const cart = await cartService.createCart(TENANT_ID, MERCHANT_ID, {
        salesChannel: "phone_order",
      });
      await cartService.addItem(TENANT_ID, cart.id, {
        menuItemId: MENU_ITEM_ID,
        quantity: 1,
      });
      await cartService.checkout(TENANT_ID, cart.id, {
        customerFirstName: "Test",
        customerLastName: "User",
        customerPhone: "555-0101",
        orderMode: "pickup",
      });

      // Attempt to add item to submitted cart
      await expect(
        cartService.addItem(TENANT_ID, cart.id, {
          menuItemId: MENU_ITEM_ID,
          quantity: 1,
        })
      ).rejects.toThrow("CART_NOT_ACTIVE");
    });

    it("cancelled cart rejects addItem with CART_NOT_ACTIVE", async () => {
      const cart = await cartService.createCart(TENANT_ID, MERCHANT_ID, {
        salesChannel: "phone_order",
      });
      await cartService.cancelCart(TENANT_ID, cart.id);

      await expect(
        cartService.addItem(TENANT_ID, cart.id, {
          menuItemId: MENU_ITEM_ID,
          quantity: 1,
        })
      ).rejects.toThrow("CART_NOT_ACTIVE");
    });

    it("submitted cart rejects cancelCart with CART_NOT_ACTIVE", async () => {
      setupOrderCreationMocks(3);

      const cart = await cartService.createCart(TENANT_ID, MERCHANT_ID, {
        salesChannel: "phone_order",
      });
      await cartService.addItem(TENANT_ID, cart.id, {
        menuItemId: MENU_ITEM_ID,
        quantity: 1,
      });
      await cartService.checkout(TENANT_ID, cart.id, {
        customerFirstName: "Test",
        customerLastName: "User",
        customerPhone: "555-0102",
        orderMode: "pickup",
      });

      await expect(
        cartService.cancelCart(TENANT_ID, cart.id)
      ).rejects.toThrow("CART_NOT_ACTIVE");
    });
  });

  // =========================================================================
  // 3. Tenant isolation
  // =========================================================================
  describe("Tenant isolation", () => {
    it("getCart with wrong tenantId throws CART_NOT_FOUND", async () => {
      const cart = await cartService.createCart(TENANT_ID, MERCHANT_ID, {
        salesChannel: "phone_order",
      });

      await expect(
        cartService.getCart(TENANT_B_ID, cart.id)
      ).rejects.toThrow("CART_NOT_FOUND");
    });
  });

  // =========================================================================
  // 4. Menu item validation
  // =========================================================================
  describe("Menu item validation", () => {
    it("addItem with nonexistent menuItemId throws CART_MENU_ITEM_NOT_FOUND", async () => {
      const cart = await cartService.createCart(TENANT_ID, MERCHANT_ID, {
        salesChannel: "phone_order",
      });

      const fakeMenuItemId = generateEntityId();

      await expect(
        cartService.addItem(TENANT_ID, cart.id, {
          menuItemId: fakeMenuItemId,
          quantity: 1,
        })
      ).rejects.toThrow("CART_MENU_ITEM_NOT_FOUND");
    });
  });
});
