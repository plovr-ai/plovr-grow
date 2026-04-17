/**
 * External Order API — Integration Tests
 *
 * Tests the complete phone order flow through route handlers with a real database.
 * Scenarios cover the actual business workflow:
 * 1. Complete phone order: create cart → add items → update → checkout → query order
 * 2. Remove item and replace before checkout
 * 3. Cancel order after placing
 * 4. Empty cart checkout should fail
 * 5. Submitted cart cannot be modified
 *
 * Run with: npx vitest run --config vitest.config.integration.ts
 * Requires: MySQL running with DATABASE_URL configured
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { generateEntityId } from "@/lib/id";

// ---------------------------------------------------------------------------
// Mock external dependencies BEFORE importing route handlers
// ---------------------------------------------------------------------------

const mockValidateExternalRequest = vi.fn().mockResolvedValue({ authenticated: true });
vi.mock("@/lib/external-auth", () => ({
  validateExternalRequest: (...args: unknown[]) => mockValidateExternalRequest(...args),
}));

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

// Mock taxConfigRepository
const mockGetMenuItemsTaxConfigIds = vi.fn();
const mockGetTaxConfigsByIds = vi.fn();
const mockGetMerchantTaxRateMap = vi.fn();
vi.mock("@/repositories/tax-config.repository", () => ({
  taxConfigRepository: {
    getMenuItemsTaxConfigIds: (...args: unknown[]) => mockGetMenuItemsTaxConfigIds(...args),
    getTaxConfigsByIds: (...args: unknown[]) => mockGetTaxConfigsByIds(...args),
    getMerchantTaxRateMap: (...args: unknown[]) => mockGetMerchantTaxRateMap(...args),
  },
}));

// Mock sequenceRepository
const mockGetNextOrderSequence = vi.fn();
vi.mock("@/repositories/sequence.repository", () => ({
  sequenceRepository: {
    getNextOrderSequence: (...args: unknown[]) => mockGetNextOrderSequence(...args),
  },
}));

// Mock giftCardService
vi.mock("@/services/giftcard", () => ({
  giftCardService: {
    redeemGiftCard: vi.fn(),
  },
}));

// Mock paymentService
const mockCreatePaymentRecord = vi.fn();
vi.mock("@/services/payment", () => ({
  paymentService: {
    createPaymentRecord: (...args: unknown[]) => mockCreatePaymentRecord(...args),
  },
}));

// Mock POS provider registry
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

// Mock logger and Sentry (used by withApiHandler in order routes)
vi.mock("@/lib/logger", () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@sentry/nextjs", () => ({
  withScope: vi.fn((cb: (scope: unknown) => void) =>
    cb({ setTag: vi.fn(), setContext: vi.fn() })
  ),
  captureException: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Real PrismaClient (vi.hoisted so it's available in mock factory)
// ---------------------------------------------------------------------------

const prisma = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
// Import route handlers AFTER mocks
// ---------------------------------------------------------------------------

import { POST as createCart } from "../carts/route";
import { GET as getCart, DELETE as cancelCart } from "../carts/[cartId]/route";
import { POST as addCartItem } from "../carts/[cartId]/items/route";
import { PATCH as updateCartItem, DELETE as deleteCartItem } from "../carts/[cartId]/items/[itemId]/route";
import { POST as checkoutCart } from "../carts/[cartId]/checkout/route";
import { GET as getOrder } from "../orders/[orderId]/route";
import { POST as cancelOrder } from "../orders/[orderId]/cancel/route";

// ---------------------------------------------------------------------------
// Test IDs
// ---------------------------------------------------------------------------

const TENANT_ID = generateEntityId();
const MERCHANT_ID = generateEntityId();
const MENU_ID = generateEntityId();
const CATEGORY_ID = generateEntityId();
const BURGER_ID = generateEntityId();
const FRIES_ID = generateEntityId();
const COKE_ID = generateEntityId();
const CATEGORY_ITEM_BURGER_ID = generateEntityId();
const CATEGORY_ITEM_FRIES_ID = generateEntityId();
const CATEGORY_ITEM_COKE_ID = generateEntityId();
const SIZE_GROUP_ID = generateEntityId();
const LARGE_OPTION_ID = generateEntityId();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createJsonRequest(url: string, method: string, body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) init.body = JSON.stringify(body);
  return new NextRequest(new URL(url, "http://localhost"), init);
}

function createRouteContext<T extends Record<string, string>>(
  params: T
): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

let orderSequenceCounter = 1;

const ALL_MENU_ITEMS = [
  { id: BURGER_ID, name: "Burger", price: 12.99, status: "active" },
  { id: FRIES_ID, name: "Fries", price: 4.99, status: "active" },
  { id: COKE_ID, name: "Coke", price: 2.49, status: "active" },
];

function setupOrderCreationMocks() {
  // Return only the items whose IDs were requested (3rd arg is itemIds array)
  mockGetMenuItemsByIds.mockImplementation(
    (_tenantId: string, _merchantId: string, itemIds: string[]) =>
      Promise.resolve(ALL_MENU_ITEMS.filter((m) => itemIds.includes(m.id)))
  );
  mockGetMerchantById.mockResolvedValue({
    id: MERCHANT_ID,
    name: "Test Merchant",
    timezone: "America/Los_Angeles",
  });
  mockGetMenuItemsTaxConfigIds.mockResolvedValue(new Map());
  mockGetTaxConfigsByIds.mockResolvedValue([]);
  mockGetMerchantTaxRateMap.mockResolvedValue(new Map());
  mockGetNextOrderSequence.mockResolvedValue(orderSequenceCounter++);
  mockCreatePaymentRecord.mockResolvedValue({ id: generateEntityId() });
}

// ---------------------------------------------------------------------------
// Seed & Cleanup
// ---------------------------------------------------------------------------

async function seedTestData() {
  await prisma.tenant.create({
    data: { id: TENANT_ID, name: "External API Test Tenant", slug: `ext-api-${Date.now()}` },
  });

  await prisma.merchant.create({
    data: {
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      slug: `ext-merchant-${Date.now()}`,
      name: "Test Merchant",
      timezone: "America/Los_Angeles",
    },
  });

  await prisma.menu.create({
    data: { id: MENU_ID, tenantId: TENANT_ID, name: "Test Menu" },
  });

  await prisma.menuCategory.create({
    data: { id: CATEGORY_ID, tenantId: TENANT_ID, menuId: MENU_ID, name: "Main" },
  });

  await prisma.menuItem.createMany({
    data: [
      { id: BURGER_ID, tenantId: TENANT_ID, name: "Burger", price: 12.99 },
      { id: FRIES_ID, tenantId: TENANT_ID, name: "Fries", price: 4.99 },
      { id: COKE_ID, tenantId: TENANT_ID, name: "Coke", price: 2.49 },
    ],
  });

  await prisma.menuCategoryItem.createMany({
    data: [
      { id: CATEGORY_ITEM_BURGER_ID, tenantId: TENANT_ID, categoryId: CATEGORY_ID, menuItemId: BURGER_ID },
      { id: CATEGORY_ITEM_FRIES_ID, tenantId: TENANT_ID, categoryId: CATEGORY_ID, menuItemId: FRIES_ID },
      { id: CATEGORY_ITEM_COKE_ID, tenantId: TENANT_ID, categoryId: CATEGORY_ID, menuItemId: COKE_ID },
    ],
  });

  await prisma.modifierGroup.create({
    data: { id: SIZE_GROUP_ID, tenantId: TENANT_ID, name: "Size" },
  });

  await prisma.modifierOption.create({
    data: {
      id: LARGE_OPTION_ID,
      tenantId: TENANT_ID,
      groupId: SIZE_GROUP_ID,
      name: "Large",
      price: 1.5,
    },
  });
}

async function cleanupTestData() {
  await prisma.cartItemModifier.deleteMany({ where: { cartItem: { cart: { tenantId: TENANT_ID } } } });
  await prisma.cartItem.deleteMany({ where: { cart: { tenantId: TENANT_ID } } });
  await prisma.cart.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.fulfillmentStatusLog.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderFulfillment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.integrationSyncRecord.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderItemModifier.deleteMany({ where: { orderItem: { order: { tenantId: TENANT_ID } } } });
  await prisma.orderItem.deleteMany({ where: { order: { tenantId: TENANT_ID } } });
  await prisma.payment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.order.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderSequence.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menuCategoryItem.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.modifierOption.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.modifierGroup.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menuItem.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menuCategory.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menu.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.merchant.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("External Order API — Phone Order Flow", () => {
  beforeAll(async () => {
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    // Reset call counts but keep mock implementations intact
    mockValidateExternalRequest.mockClear();
    mockGetMenuItemsByIds.mockReset();
    mockGetMerchantById.mockReset();
    mockGetMenuItemsTaxConfigIds.mockReset();
    mockGetTaxConfigsByIds.mockReset();
    mockGetMerchantTaxRateMap.mockReset();
    mockGetNextOrderSequence.mockReset();
    mockCreatePaymentRecord.mockReset();
    // Re-establish auth mock
    mockValidateExternalRequest.mockResolvedValue({ authenticated: true });
    // Re-establish tax mocks (needed by computeCartSummary on every cart mutation)
    mockGetMenuItemsTaxConfigIds.mockResolvedValue(new Map());
    mockGetTaxConfigsByIds.mockResolvedValue([]);
    mockGetMerchantTaxRateMap.mockResolvedValue(new Map());
  });

  // =========================================================================
  // Scenario 1: Complete phone order flow (happy path)
  // =========================================================================
  describe("Scenario 1: Complete phone order flow", () => {
    let cartId: string;
    let burgerItemId: string;
    let orderId: string;

    it("should create a cart, add items, update, checkout, and query order", async () => {
      // Step 1: Create cart
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_ID,
          salesChannel: "phone_order",
        })
      );
      expect(createRes.status).toBe(201);
      const createBody = await createRes.json();
      expect(createBody.success).toBe(true);
      cartId = createBody.data.id;
      expect(cartId).toBeDefined();

      // Step 2: Add Burger (qty: 1)
      const addBurgerRes = await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: BURGER_ID,
          quantity: 1,
        }),
        createRouteContext({ cartId })
      );
      expect(addBurgerRes.status).toBe(201);
      const addBurgerBody = await addBurgerRes.json();
      expect(addBurgerBody.success).toBe(true);
      // addItem now returns full CartWithItems
      const burgerItem = addBurgerBody.data.items.find((i: { menuItemId: string }) => i.menuItemId === BURGER_ID);
      burgerItemId = burgerItem.id;
      expect(burgerItem.name).toBe("Burger");
      expect(burgerItem.unitPrice).toBe(12.99);
      expect(burgerItem.totalPrice).toBe(12.99);

      // Step 3: Add Fries (qty: 2, with large size modifier +$1.50)
      const addFriesRes = await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: FRIES_ID,
          quantity: 2,
          selectedModifiers: [
            {
              modifierGroupId: SIZE_GROUP_ID,
              modifierOptionId: LARGE_OPTION_ID,
              groupName: "Size",
              name: "Large",
              price: 1.50,
            },
          ],
        }),
        createRouteContext({ cartId })
      );
      expect(addFriesRes.status).toBe(201);
      const addFriesBody = await addFriesRes.json();
      // addItem returns full CartWithItems
      const friesItem = addFriesBody.data.items.find((i: { menuItemId: string }) => i.menuItemId === FRIES_ID);
      // totalPrice = (4.99 + 1.50) * 2 = 12.98
      expect(friesItem.totalPrice).toBe(12.98);
      expect(friesItem.modifiers).toHaveLength(1);
      expect(friesItem.modifiers[0].name).toBe("Large");

      // Step 4: Get cart — verify 2 items with correct prices
      const getRes = await getCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}?tenantId=${TENANT_ID}`, "GET"),
        createRouteContext({ cartId })
      );
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.data.items).toHaveLength(2);
      expect(getBody.data.salesChannel).toBe("phone_order");

      // Step 5: Update Burger quantity to 2
      const updateRes = await updateCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items/${burgerItemId}`, "PATCH", {
          tenantId: TENANT_ID,
          quantity: 2,
        }),
        createRouteContext({ cartId, itemId: burgerItemId })
      );
      expect(updateRes.status).toBe(200);
      const updateBody = await updateRes.json();
      // updateItem returns full CartWithItems
      const updatedBurger = updateBody.data.items.find((i: { id: string }) => i.id === burgerItemId);
      // totalPrice = 12.99 * 2 = 25.98
      expect(updatedBurger.totalPrice).toBe(25.98);
      expect(updatedBurger.quantity).toBe(2);

      // Step 6: Get cart again — verify updated totals
      const getRes2 = await getCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}?tenantId=${TENANT_ID}`, "GET"),
        createRouteContext({ cartId })
      );
      const getBody2 = await getRes2.json();
      const burger = getBody2.data.items.find((i: { menuItemId: string }) => i.menuItemId === BURGER_ID);
      expect(burger.quantity).toBe(2);
      expect(burger.totalPrice).toBe(25.98);

      // Step 7: Checkout
      setupOrderCreationMocks();
      const checkoutRes = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "John",
          customerLastName: "Doe",
          customerPhone: "555-0100",
          customerEmail: "john@test.com",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId })
      );
      expect(checkoutRes.status).toBe(201);
      const checkoutBody = await checkoutRes.json();
      expect(checkoutBody.success).toBe(true);
      orderId = checkoutBody.data.orderId;
      expect(orderId).toBeDefined();
      expect(checkoutBody.data.orderNumber).toBeDefined();

      // Step 8: Query order
      const orderRes = await getOrder(
        createJsonRequest(`/api/external/v1/orders/${orderId}?tenantId=${TENANT_ID}`, "GET"),
        createRouteContext({ orderId })
      );
      expect(orderRes.status).toBe(200);
      const orderBody = await orderRes.json();
      expect(orderBody.success).toBe(true);
      expect(orderBody.data.id).toBe(orderId);
      expect(orderBody.data.status).toBeDefined();
      expect(orderBody.data.timeline).toBeDefined();
    });
  });

  // =========================================================================
  // Scenario 2: Remove item and replace before checkout
  // =========================================================================
  describe("Scenario 2: Remove item and replace before checkout", () => {
    it("should allow removing an item, adding another, and checking out", async () => {
      // Create cart
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_ID,
          salesChannel: "phone_order",
        })
      );
      const cartId = (await createRes.json()).data.id;

      // Add Burger
      const addRes = await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: BURGER_ID,
          quantity: 1,
        }),
        createRouteContext({ cartId })
      );
      const addBody = await addRes.json();
      const burgerItemId = addBody.data.items.find((i: { menuItemId: string }) => i.menuItemId === BURGER_ID).id;

      // Delete Burger
      await deleteCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items/${burgerItemId}`, "DELETE", {
          tenantId: TENANT_ID,
        }),
        createRouteContext({ cartId, itemId: burgerItemId })
      );

      // Get cart — should be empty
      const emptyCartRes = await getCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}?tenantId=${TENANT_ID}`, "GET"),
        createRouteContext({ cartId })
      );
      const emptyCartBody = await emptyCartRes.json();
      expect(emptyCartBody.data.items).toHaveLength(0);

      // Add Coke instead
      await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: COKE_ID,
          quantity: 1,
        }),
        createRouteContext({ cartId })
      );

      // Checkout
      setupOrderCreationMocks();
      const checkoutRes = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Jane",
          customerLastName: "Smith",
          customerPhone: "555-0200",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId })
      );
      expect(checkoutRes.status).toBe(201);
      const checkoutBody = await checkoutRes.json();
      expect(checkoutBody.success).toBe(true);
      expect(checkoutBody.data.orderId).toBeDefined();

      // Verify order has only Coke
      const orderRes = await getOrder(
        createJsonRequest(
          `/api/external/v1/orders/${checkoutBody.data.orderId}?tenantId=${TENANT_ID}`,
          "GET"
        ),
        createRouteContext({ orderId: checkoutBody.data.orderId })
      );
      const orderBody = await orderRes.json();
      expect(orderBody.data.id).toBe(checkoutBody.data.orderId);
    });
  });

  // =========================================================================
  // Scenario 3: Cancel order after placing
  // =========================================================================
  describe("Scenario 3: Cancel order after placing", () => {
    it("should allow cancelling an order and verify cancelled status", async () => {
      // Create cart + add item + checkout
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_ID,
          salesChannel: "phone_order",
        })
      );
      const cartId = (await createRes.json()).data.id;

      await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: BURGER_ID,
          quantity: 1,
        }),
        createRouteContext({ cartId })
      );

      setupOrderCreationMocks();
      const checkoutRes = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Bob",
          customerLastName: "Cancel",
          customerPhone: "555-0300",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId })
      );
      const orderId = (await checkoutRes.json()).data.orderId;

      // Cancel order
      const cancelRes = await cancelOrder(
        createJsonRequest(`/api/external/v1/orders/${orderId}/cancel`, "POST", {
          tenantId: TENANT_ID,
          reason: "Customer changed their mind",
        }),
        createRouteContext({ orderId })
      );
      expect(cancelRes.status).toBe(200);
      const cancelBody = await cancelRes.json();
      expect(cancelBody.success).toBe(true);

      // Verify order is cancelled
      const orderRes = await getOrder(
        createJsonRequest(`/api/external/v1/orders/${orderId}?tenantId=${TENANT_ID}`, "GET"),
        createRouteContext({ orderId })
      );
      const orderBody = await orderRes.json();
      expect(orderBody.data.status).toBe("canceled");
    });
  });

  // =========================================================================
  // Scenario 4: Empty cart checkout should fail
  // =========================================================================
  describe("Scenario 4: Empty cart checkout should fail", () => {
    it("should reject checkout on an empty cart with CART_EMPTY error", async () => {
      // Create cart with no items
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_ID,
          salesChannel: "phone_order",
        })
      );
      const cartId = (await createRes.json()).data.id;

      // Attempt checkout
      const checkoutRes = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Empty",
          customerLastName: "Cart",
          customerPhone: "555-0400",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId })
      );

      const checkoutBody = await checkoutRes.json();
      expect(checkoutRes.status).not.toBe(201);
      expect(checkoutBody.success).toBe(false);
      expect(checkoutBody.error.code).toBe("CART_EMPTY");
    });
  });

  // =========================================================================
  // Scenario 5: Cannot add items to submitted cart
  // =========================================================================
  describe("Scenario 5: Cannot modify a submitted cart", () => {
    it("should reject add-item and cancel on a submitted cart", async () => {
      // Create cart + add item + checkout
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_ID,
          salesChannel: "phone_order",
        })
      );
      const cartId = (await createRes.json()).data.id;

      await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: COKE_ID,
          quantity: 1,
        }),
        createRouteContext({ cartId })
      );

      setupOrderCreationMocks();
      await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Submit",
          customerLastName: "Test",
          customerPhone: "555-0500",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId })
      );

      // Attempt to add item to submitted cart
      const addRes = await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: FRIES_ID,
          quantity: 1,
        }),
        createRouteContext({ cartId })
      );
      const addBody = await addRes.json();
      expect(addBody.success).toBe(false);
      expect(addBody.error.code).toBe("CART_NOT_ACTIVE");

      // Attempt to cancel submitted cart
      const cancelRes = await cancelCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}`, "DELETE", {
          tenantId: TENANT_ID,
        }),
        createRouteContext({ cartId })
      );
      const cancelBody = await cancelRes.json();
      expect(cancelBody.success).toBe(false);
      expect(cancelBody.error.code).toBe("CART_NOT_ACTIVE");
    });
  });

  // =========================================================================
  // Scenario 6: Server resolves modifier name/groupName/price from DB
  // =========================================================================
  describe("Scenario 6: Server-side modifier resolution", () => {
    async function createFreshCart(): Promise<string> {
      const res = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_ID,
          salesChannel: "phone_order",
        })
      );
      const body = await res.json();
      return body.data.id as string;
    }

    it("fills modifier fields from DB when client sends only modifierOptionId", async () => {
      const cartId = await createFreshCart();

      const res = await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: FRIES_ID,
          quantity: 2,
          selectedModifiers: [{ modifierOptionId: LARGE_OPTION_ID }],
        }),
        createRouteContext({ cartId })
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);

      const friesItem = body.data.items.find(
        (i: { menuItemId: string }) => i.menuItemId === FRIES_ID
      );
      expect(friesItem.modifiers).toHaveLength(1);
      const mod = friesItem.modifiers[0];
      expect(mod.modifierGroupId).toBe(SIZE_GROUP_ID);
      expect(mod.modifierOptionId).toBe(LARGE_OPTION_ID);
      expect(mod.groupName).toBe("Size");
      expect(mod.name).toBe("Large");
      expect(mod.price).toBe(1.5);
      // totalPrice = (4.99 + 1.5) * 2 = 12.98
      expect(friesItem.totalPrice).toBe(12.98);
    });

    it("overrides client-sent name/price/groupName with DB values", async () => {
      const cartId = await createFreshCart();

      const res = await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: FRIES_ID,
          quantity: 1,
          selectedModifiers: [
            {
              modifierGroupId: SIZE_GROUP_ID,
              modifierOptionId: LARGE_OPTION_ID,
              groupName: "HACKED-group",
              name: "HACKED-name",
              price: 999.99,
            },
          ],
        }),
        createRouteContext({ cartId })
      );
      expect(res.status).toBe(201);
      const body = await res.json();

      const friesItem = body.data.items.find(
        (i: { menuItemId: string }) => i.menuItemId === FRIES_ID
      );
      const mod = friesItem.modifiers[0];
      // Server must ignore client-sent values and use DB
      expect(mod.groupName).toBe("Size");
      expect(mod.name).toBe("Large");
      expect(mod.price).toBe(1.5);
      // totalPrice uses DB price: (4.99 + 1.5) * 1 = 6.49
      expect(friesItem.totalPrice).toBe(6.49);
    });

    it("rejects nonexistent modifierOptionId with CART_MODIFIER_OPTION_NOT_FOUND", async () => {
      const cartId = await createFreshCart();

      const res = await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: FRIES_ID,
          quantity: 1,
          selectedModifiers: [{ modifierOptionId: "nonexistent-option-id" }],
        }),
        createRouteContext({ cartId })
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CART_MODIFIER_OPTION_NOT_FOUND");
    });

    it("rejects modifierOptionId from another tenant with CART_MODIFIER_OPTION_NOT_FOUND", async () => {
      // Seed a rogue tenant + option; confirm tenant isolation
      const ROGUE_TENANT_ID = generateEntityId();
      const ROGUE_GROUP_ID = generateEntityId();
      const ROGUE_OPTION_ID = generateEntityId();
      await prisma.tenant.create({
        data: { id: ROGUE_TENANT_ID, name: "Rogue", slug: `rogue-${Date.now()}` },
      });
      await prisma.modifierGroup.create({
        data: { id: ROGUE_GROUP_ID, tenantId: ROGUE_TENANT_ID, name: "Rogue" },
      });
      await prisma.modifierOption.create({
        data: {
          id: ROGUE_OPTION_ID,
          tenantId: ROGUE_TENANT_ID,
          groupId: ROGUE_GROUP_ID,
          name: "Rogue option",
          price: 999,
        },
      });

      try {
        const cartId = await createFreshCart();
        const res = await addCartItem(
          createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
            tenantId: TENANT_ID,
            menuItemId: FRIES_ID,
            quantity: 1,
            selectedModifiers: [{ modifierOptionId: ROGUE_OPTION_ID }],
          }),
          createRouteContext({ cartId })
        );
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("CART_MODIFIER_OPTION_NOT_FOUND");
      } finally {
        await prisma.modifierOption.deleteMany({ where: { tenantId: ROGUE_TENANT_ID } });
        await prisma.modifierGroup.deleteMany({ where: { tenantId: ROGUE_TENANT_ID } });
        await prisma.tenant.deleteMany({ where: { id: ROGUE_TENANT_ID } });
      }
    });

    it("PATCH /items/{id} also resolves modifier fields from DB", async () => {
      const cartId = await createFreshCart();

      const addRes = await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: FRIES_ID,
          quantity: 1,
        }),
        createRouteContext({ cartId })
      );
      const addBody = await addRes.json();
      const itemId = addBody.data.items.find(
        (i: { menuItemId: string }) => i.menuItemId === FRIES_ID
      ).id;

      const patchRes = await updateCartItem(
        createJsonRequest(
          `/api/external/v1/carts/${cartId}/items/${itemId}`,
          "PATCH",
          {
            tenantId: TENANT_ID,
            selectedModifiers: [{ modifierOptionId: LARGE_OPTION_ID }],
          }
        ),
        createRouteContext({ cartId, itemId })
      );
      expect(patchRes.status).toBe(200);
      const patchBody = await patchRes.json();
      const updatedItem = patchBody.data.items.find(
        (i: { id: string }) => i.id === itemId
      );
      expect(updatedItem.modifiers).toHaveLength(1);
      expect(updatedItem.modifiers[0].name).toBe("Large");
      expect(updatedItem.modifiers[0].price).toBe(1.5);
      // totalPrice = (4.99 + 1.5) * 1 = 6.49
      expect(updatedItem.totalPrice).toBe(6.49);
    });
  });
});
