/**
 * Phone-AI Order Flow — Integration Tests
 *
 * Tests the complete phone ordering scenario end-to-end:
 * phone-AI lookup merchant → query knowledge → create cart → add items →
 * update/delete items → checkout → get order → cancel order.
 *
 * Covers edge cases, validation, tenant isolation, and concurrency.
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

// Mock menuService (used by orderService during checkout and knowledge query)
const mockGetMenuItemsByIds = vi.fn();
const mockGetMenu = vi.fn();
vi.mock("@/services/menu", () => ({
  menuService: {
    getMenuItemsByIds: (...args: unknown[]) => mockGetMenuItemsByIds(...args),
    getMenu: (...args: unknown[]) => mockGetMenu(...args),
  },
}));

// Mock merchantService (used by orderService during checkout and knowledge query)
// Also exposes lookupByAiPhone as a pass-through to the real repository so the
// merchants/lookup endpoint continues to hit the integration test DB.
const mockGetMerchantById = vi.fn();
vi.mock("@/services/merchant", async () => {
  const { merchantRepository } = await import(
    "@/repositories/merchant.repository"
  );
  return {
    merchantService: {
      getMerchantById: (...args: unknown[]) => mockGetMerchantById(...args),
      lookupByAiPhone: (phone: string) =>
        merchantRepository.getByAiPhone(phone),
    },
  };
});

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

// Mock logger and Sentry (used by withApiHandler)
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
import { GET as getCart } from "../carts/[cartId]/route";
import { POST as addCartItem } from "../carts/[cartId]/items/route";
import { PATCH as updateCartItem, DELETE as deleteCartItem } from "../carts/[cartId]/items/[itemId]/route";
import { POST as checkoutCart } from "../carts/[cartId]/checkout/route";
import { GET as getOrder } from "../orders/[orderId]/route";
import { POST as cancelOrder } from "../orders/[orderId]/cancel/route";
import { POST as lookupMerchant } from "../merchants/lookup/route";
import { POST as queryKnowledge } from "../knowledge/query/route";

// ---------------------------------------------------------------------------
// Test IDs
// ---------------------------------------------------------------------------

const TENANT_ID = generateEntityId();
const OTHER_TENANT_ID = generateEntityId();
const MERCHANT_A_ID = generateEntityId();
const MERCHANT_B_ID = generateEntityId();
const MENU_ID = generateEntityId();
const CATEGORY_ID = generateEntityId();
const BURGER_ID = generateEntityId();
const FRIES_ID = generateEntityId();
const COKE_ID = generateEntityId();
const CATEGORY_ITEM_BURGER_ID = generateEntityId();
const CATEGORY_ITEM_FRIES_ID = generateEntityId();
const CATEGORY_ITEM_COKE_ID = generateEntityId();

const timestamp = Date.now();
const MERCHANT_A_SLUG = `burger-joint-${timestamp}`;
const MERCHANT_B_SLUG = `pizza-place-${timestamp}`;
const MERCHANT_A_AI_PHONE = "+14085550001";
const MERCHANT_B_AI_PHONE = "+14085550002";

// ---------------------------------------------------------------------------
// Merchant data for merchantService mock
// ---------------------------------------------------------------------------

const MERCHANT_A_DATA = {
  id: MERCHANT_A_ID,
  slug: MERCHANT_A_SLUG,
  name: "Burger Joint",
  tenantId: TENANT_ID,
  address: "100 Main St",
  city: "San Jose",
  state: "CA",
  zipCode: "95101",
  country: "US",
  phone: "+14085559000",
  email: "info@burgerjoint.test",
  timezone: "America/Los_Angeles",
  currency: "USD",
  locale: "en-US",
  status: "active",
  businessHours: {
    monday: { open: "10:00", close: "21:00" },
    tuesday: { open: "10:00", close: "21:00" },
    wednesday: { open: "10:00", close: "21:00" },
    thursday: { open: "10:00", close: "21:00" },
    friday: { open: "10:00", close: "22:00" },
    saturday: { open: "11:00", close: "22:00" },
    sunday: { open: "11:00", close: "20:00" },
  },
  settings: {
    acceptsPickup: true,
    acceptsDelivery: false,
    minimumOrderAmount: 10,
    estimatedPrepTime: 15,
  },
  phoneAiSettings: {
    greetings: "Welcome to Burger Joint!",
    faq: {
      savedFaqs: [
        { question: "Do you have vegetarian options?", answer: "Yes, we have a veggie burger." },
      ],
      customFaqs: [],
    },
    agentWorkSwitch: "0",
    forwardPhone: "+14085559999",
  },
  tenant: {
    id: TENANT_ID,
    slug: `phone-ai-order-test-${timestamp}`,
    tenantId: TENANT_ID,
    name: "Phone AI Order Test Tenant",
    subscriptionStatus: "active",
  },
};

const MERCHANT_B_DATA = {
  id: MERCHANT_B_ID,
  slug: MERCHANT_B_SLUG,
  name: "Pizza Place",
  tenantId: TENANT_ID,
  address: "200 Oak Ave",
  city: "San Jose",
  state: "CA",
  zipCode: "95102",
  country: "US",
  phone: "+14085559001",
  email: "info@pizzaplace.test",
  timezone: "America/Los_Angeles",
  currency: "USD",
  locale: "en-US",
  status: "active",
  businessHours: {
    monday: { open: "11:00", close: "22:00" },
  },
  settings: {
    acceptsPickup: true,
    acceptsDelivery: true,
    minimumOrderAmount: 20,
    estimatedPrepTime: 25,
  },
  // No phoneAiSettings
  tenant: {
    id: TENANT_ID,
    slug: `phone-ai-order-test-${timestamp}`,
    tenantId: TENANT_ID,
    name: "Phone AI Order Test Tenant",
    subscriptionStatus: "active",
  },
};

const MOCK_MENU_DATA = {
  categories: [
    {
      id: CATEGORY_ID,
      name: "Main",
      items: [
        { id: BURGER_ID, name: "Burger", price: 12.99 },
        { id: FRIES_ID, name: "Fries", price: 4.99 },
        { id: COKE_ID, name: "Coke", price: 2.49 },
      ],
    },
  ],
};

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
  mockGetMenuItemsByIds.mockImplementation(
    (_tenantId: string, _merchantId: string, itemIds: string[]) =>
      Promise.resolve(ALL_MENU_ITEMS.filter((m) => itemIds.includes(m.id)))
  );
  mockGetMerchantById.mockResolvedValue({
    id: MERCHANT_A_ID,
    name: "Burger Joint",
    timezone: "America/Los_Angeles",
  });
  mockGetMenuItemsTaxConfigIds.mockResolvedValue(new Map());
  mockGetTaxConfigsByIds.mockResolvedValue([]);
  mockGetMerchantTaxRateMap.mockResolvedValue(new Map());
  mockGetNextOrderSequence.mockResolvedValue(orderSequenceCounter++);
  mockCreatePaymentRecord.mockResolvedValue({ id: generateEntityId() });
}

function setupMerchantServiceMock(
  ...merchants: (typeof MERCHANT_A_DATA | typeof MERCHANT_B_DATA)[]
) {
  mockGetMerchantById.mockImplementation((id: string) => {
    const found = merchants.find((m) => m.id === id);
    return Promise.resolve(found ?? null);
  });
}

// ---------------------------------------------------------------------------
// Seed & Cleanup
// ---------------------------------------------------------------------------

async function seedTestData() {
  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: "Phone AI Order Test Tenant",
      slug: `phone-ai-order-test-${timestamp}`,
    },
  });

  // Second tenant for cross-tenant isolation tests
  await prisma.tenant.create({
    data: {
      id: OTHER_TENANT_ID,
      name: "Other Tenant",
      slug: `other-tenant-${timestamp}`,
    },
  });

  await prisma.merchant.createMany({
    data: [
      {
        id: MERCHANT_A_ID,
        tenantId: TENANT_ID,
        slug: MERCHANT_A_SLUG,
        name: "Burger Joint",
        aiPhone: MERCHANT_A_AI_PHONE,
        address: "100 Main St",
        city: "San Jose",
        state: "CA",
        zipCode: "95101",
        phone: "+14085559000",
        email: "info@burgerjoint.test",
        timezone: "America/Los_Angeles",
        currency: "USD",
        locale: "en-US",
        businessHours: JSON.parse(JSON.stringify(MERCHANT_A_DATA.businessHours)),
        settings: JSON.parse(JSON.stringify(MERCHANT_A_DATA.settings)),
        phoneAiSettings: JSON.parse(JSON.stringify(MERCHANT_A_DATA.phoneAiSettings)),
      },
      {
        id: MERCHANT_B_ID,
        tenantId: TENANT_ID,
        slug: MERCHANT_B_SLUG,
        name: "Pizza Place",
        aiPhone: MERCHANT_B_AI_PHONE,
        address: "200 Oak Ave",
        city: "San Jose",
        state: "CA",
        zipCode: "95102",
        phone: "+14085559001",
        email: "info@pizzaplace.test",
        timezone: "America/Los_Angeles",
        currency: "USD",
        locale: "en-US",
        businessHours: JSON.parse(JSON.stringify(MERCHANT_B_DATA.businessHours)),
        settings: JSON.parse(JSON.stringify(MERCHANT_B_DATA.settings)),
        // No phoneAiSettings for merchant B
      },
    ],
  });

  await prisma.menu.create({
    data: { id: MENU_ID, tenantId: TENANT_ID, name: "Burger Joint Menu" },
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
}

async function cleanupTestData() {
  // Delete in correct FK order
  await prisma.cartItemModifier.deleteMany({ where: { cartItem: { cart: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } } } });
  await prisma.cartItem.deleteMany({ where: { cart: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } } });
  await prisma.cart.deleteMany({ where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } });
  await prisma.fulfillmentStatusLog.deleteMany({ where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } });
  await prisma.orderFulfillment.deleteMany({ where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } });
  await prisma.integrationSyncRecord.deleteMany({ where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } });
  await prisma.orderItemModifier.deleteMany({ where: { orderItem: { order: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } } } });
  await prisma.orderItem.deleteMany({ where: { order: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } } });
  await prisma.payment.deleteMany({ where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } });
  await prisma.order.deleteMany({ where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } });
  await prisma.orderSequence.deleteMany({ where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } });
  await prisma.menuCategoryItem.deleteMany({ where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } });
  await prisma.menuItem.deleteMany({ where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } });
  await prisma.menuCategory.deleteMany({ where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } });
  await prisma.menu.deleteMany({ where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } });
  await prisma.merchant.deleteMany({ where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [TENANT_ID, OTHER_TENANT_ID] } } });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("Phone-AI Order Flow — Integration Tests", () => {
  beforeAll(async () => {
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockValidateExternalRequest.mockClear();
    mockGetMenuItemsByIds.mockReset();
    mockGetMerchantById.mockReset();
    mockGetMenu.mockReset();
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
  // Scenario 1: Complete phone-AI call → order flow (happy path)
  // =========================================================================
  describe("Scenario 1: Complete phone-AI call → order flow (happy path)", () => {
    let cartId: string;
    let burgerItemId: string;
    let friesItemId: string;
    let orderId: string;

    it("should complete the full lifecycle from merchant lookup to order cancellation", async () => {
      // Step 1: Merchant lookup by aiPhone
      const lookupRes = await lookupMerchant(
        createJsonRequest("/api/external/v1/merchants/lookup", "POST", {
          phone: MERCHANT_A_AI_PHONE,
        }),
        createRouteContext({})
      );
      expect(lookupRes.status).toBe(200);
      const lookupBody = await lookupRes.json();
      expect(lookupBody.success).toBe(true);
      expect(lookupBody.data.tenantId).toBe(TENANT_ID);
      expect(lookupBody.data.merchantId).toBe(MERCHANT_A_ID);
      expect(lookupBody.data.merchantName).toBe("Burger Joint");
      expect(lookupBody.data.forwardPhone).toBe("+14085559999");

      // Step 2: Knowledge query (all targets)
      setupMerchantServiceMock(MERCHANT_A_DATA);
      mockGetMenu.mockResolvedValue(MOCK_MENU_DATA);

      const knowledgeRes = await queryKnowledge(
        createJsonRequest("/api/external/v1/knowledge/query", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
          targets: [
            "RESTAURANT_INFO",
            "OPENING_HOURS",
            "MENU",
            "GREETINGS",
            "FAQ",
            "SERVICE_PROVIDED",
            "AGENT_WORK_SWITCH",
          ],
        }),
        createRouteContext({})
      );
      expect(knowledgeRes.status).toBe(200);
      const knowledgeBody = await knowledgeRes.json();
      expect(knowledgeBody.success).toBe(true);
      const km = knowledgeBody.data.knowledgeMap;

      // Verify all targets return data
      expect(km.RESTAURANT_INFO).not.toBeNull();
      expect(km.OPENING_HOURS).not.toBeNull();
      expect(km.MENU).not.toBeNull();
      expect(km.GREETINGS).toEqual({ data: "Welcome to Burger Joint!" });
      expect(km.FAQ).not.toBeNull();
      expect(km.SERVICE_PROVIDED).not.toBeNull();
      expect(km.AGENT_WORK_SWITCH).toEqual({ data: "0" });

      // Step 3: Create cart (salesChannel: "phone_order")
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
          salesChannel: "phone_order",
        })
      );
      expect(createRes.status).toBe(201);
      const createBody = await createRes.json();
      expect(createBody.success).toBe(true);
      cartId = createBody.data.id;
      expect(cartId).toBeDefined();

      // Step 4: Add Burger (qty 1)
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
      const burgerItem = addBurgerBody.data.items.find(
        (i: { menuItemId: string }) => i.menuItemId === BURGER_ID
      );
      burgerItemId = burgerItem.id;
      expect(burgerItem.name).toBe("Burger");
      expect(burgerItem.unitPrice).toBe(12.99);
      expect(burgerItem.totalPrice).toBe(12.99);
      // Verify summary
      expect(addBurgerBody.data.summary.subtotal).toBe(12.99);
      expect(addBurgerBody.data.summary.taxAmount).toBe(0);
      expect(addBurgerBody.data.summary.totalAmount).toBe(12.99);

      // Step 5: Add Fries (qty 2)
      const addFriesRes = await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: FRIES_ID,
          quantity: 2,
        }),
        createRouteContext({ cartId })
      );
      expect(addFriesRes.status).toBe(201);
      const addFriesBody = await addFriesRes.json();
      expect(addFriesBody.data.items).toHaveLength(2);
      const friesItem = addFriesBody.data.items.find(
        (i: { menuItemId: string }) => i.menuItemId === FRIES_ID
      );
      friesItemId = friesItem.id;
      // subtotal = 12.99 + (4.99 * 2) = 22.97
      expect(addFriesBody.data.summary.subtotal).toBe(22.97);

      // Step 6: Get cart — verify same data
      const getRes = await getCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}?tenantId=${TENANT_ID}`, "GET"),
        createRouteContext({ cartId })
      );
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.data.items).toHaveLength(2);
      expect(getBody.data.summary.subtotal).toBe(22.97);
      expect(getBody.data.salesChannel).toBe("phone_order");

      // Step 7: Update Burger qty to 3
      const updateRes = await updateCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items/${burgerItemId}`, "PATCH", {
          tenantId: TENANT_ID,
          quantity: 3,
        }),
        createRouteContext({ cartId, itemId: burgerItemId })
      );
      expect(updateRes.status).toBe(200);
      const updateBody = await updateRes.json();
      const updatedBurger = updateBody.data.items.find(
        (i: { id: string }) => i.id === burgerItemId
      );
      // totalPrice = 12.99 * 3 = 38.97
      expect(updatedBurger.totalPrice).toBe(38.97);
      // summary subtotal = 38.97 + 9.98 = 48.95
      expect(updateBody.data.summary.subtotal).toBe(48.95);

      // Step 8: Delete Fries
      const deleteRes = await deleteCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items/${friesItemId}`, "DELETE", {
          tenantId: TENANT_ID,
        }),
        createRouteContext({ cartId, itemId: friesItemId })
      );
      expect(deleteRes.status).toBe(200);
      const deleteBody = await deleteRes.json();
      expect(deleteBody.data.items).toHaveLength(1);
      // summary subtotal = 38.97
      expect(deleteBody.data.summary.subtotal).toBe(38.97);

      // Step 9: Checkout
      setupOrderCreationMocks();
      const checkoutRes = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Alice",
          customerLastName: "Smith",
          customerPhone: "555-0100",
          customerEmail: "alice@test.com",
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

      // Step 10: Get order — verify status
      const orderRes = await getOrder(
        createJsonRequest(`/api/external/v1/orders/${orderId}?tenantId=${TENANT_ID}`, "GET"),
        createRouteContext({ orderId })
      );
      expect(orderRes.status).toBe(200);
      const orderBody = await orderRes.json();
      expect(orderBody.success).toBe(true);
      expect(orderBody.data.id).toBe(orderId);
      expect(orderBody.data.status).toBeDefined();

      // Step 11: Cancel order
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

      // Step 12: Cancel order again — verify idempotent (still success, not error)
      const cancelRes2 = await cancelOrder(
        createJsonRequest(`/api/external/v1/orders/${orderId}/cancel`, "POST", {
          tenantId: TENANT_ID,
          reason: "Duplicate cancel request",
        }),
        createRouteContext({ orderId })
      );
      expect(cancelRes2.status).toBe(200);
      const cancelBody2 = await cancelRes2.json();
      expect(cancelBody2.success).toBe(true);
    });
  });

  // =========================================================================
  // Scenario 2: Cart summary accuracy
  // =========================================================================
  describe("Scenario 2: Cart summary accuracy", () => {
    it("should have summary.subtotal equal to sum of item.totalPrice", async () => {
      // Create cart
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
          salesChannel: "phone_order",
        })
      );
      const cartId = (await createRes.json()).data.id;

      // Add Burger (qty 2)
      await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: BURGER_ID,
          quantity: 2,
        }),
        createRouteContext({ cartId })
      );

      // Add Coke (qty 3)
      const addCokeRes = await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: COKE_ID,
          quantity: 3,
        }),
        createRouteContext({ cartId })
      );
      const body = await addCokeRes.json();

      // Verify summary fields exist
      expect(body.data.summary).toHaveProperty("subtotal");
      expect(body.data.summary).toHaveProperty("taxAmount");
      expect(body.data.summary).toHaveProperty("totalAmount");

      // Verify subtotal = sum of item totalPrices
      const itemsTotal = body.data.items.reduce(
        (sum: number, item: { totalPrice: number }) => sum + item.totalPrice,
        0
      );
      expect(body.data.summary.subtotal).toBeCloseTo(itemsTotal, 2);
      // 12.99 * 2 + 2.49 * 3 = 25.98 + 7.47 = 33.45
      expect(body.data.summary.subtotal).toBe(33.45);
    });
  });

  // =========================================================================
  // Scenario 3: Validation errors
  // =========================================================================
  describe("Scenario 3: Validation errors", () => {
    let cartId: string;

    beforeAll(async () => {
      // Re-establish auth mock for beforeAll context
      mockValidateExternalRequest.mockResolvedValue({ authenticated: true });
      mockGetMenuItemsTaxConfigIds.mockResolvedValue(new Map());
      mockGetTaxConfigsByIds.mockResolvedValue([]);
      mockGetMerchantTaxRateMap.mockResolvedValue(new Map());

      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
          salesChannel: "phone_order",
        })
      );
      cartId = (await createRes.json()).data.id;
    });

    it("should return CART_MENU_ITEM_NOT_FOUND when adding non-existent menuItemId", async () => {
      const fakeMenuItemId = generateEntityId();
      const res = await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: fakeMenuItemId,
          quantity: 1,
        }),
        createRouteContext({ cartId })
      );
      const body = await res.json();
      expect(res.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CART_MENU_ITEM_NOT_FOUND");
    });

    it("should return CART_ITEM_NOT_FOUND when updating non-existent itemId", async () => {
      const fakeItemId = generateEntityId();
      const res = await updateCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items/${fakeItemId}`, "PATCH", {
          tenantId: TENANT_ID,
          quantity: 5,
        }),
        createRouteContext({ cartId, itemId: fakeItemId })
      );
      const body = await res.json();
      expect(res.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CART_ITEM_NOT_FOUND");
    });

    it("should return CART_ITEM_NOT_FOUND when deleting non-existent itemId", async () => {
      const fakeItemId = generateEntityId();
      const res = await deleteCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items/${fakeItemId}`, "DELETE", {
          tenantId: TENANT_ID,
        }),
        createRouteContext({ cartId, itemId: fakeItemId })
      );
      const body = await res.json();
      expect(res.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CART_ITEM_NOT_FOUND");
    });

    it("should return CART_EMPTY when checking out empty cart", async () => {
      // Create a fresh empty cart for this test
      const emptyCartRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
          salesChannel: "phone_order",
        })
      );
      const emptyCartId = (await emptyCartRes.json()).data.id;

      const res = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${emptyCartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Test",
          customerLastName: "Empty",
          customerPhone: "555-0000",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId: emptyCartId })
      );
      const body = await res.json();
      expect(res.status).not.toBe(201);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CART_EMPTY");
    });

    it("should return VALIDATION_FAILED when checkout is missing customerPhone", async () => {
      // Create cart with an item for checkout validation
      const cartRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
          salesChannel: "phone_order",
        })
      );
      const validCartId = (await cartRes.json()).data.id;

      await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${validCartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: BURGER_ID,
          quantity: 1,
        }),
        createRouteContext({ cartId: validCartId })
      );

      const res = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${validCartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Test",
          customerLastName: "NoPhone",
          // missing customerPhone
          orderMode: "pickup",
        }),
        createRouteContext({ cartId: validCartId })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("should return CART_NOT_FOUND when getting cart with wrong tenantId", async () => {
      const wrongTenantId = generateEntityId();
      const res = await getCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}?tenantId=${wrongTenantId}`, "GET"),
        createRouteContext({ cartId })
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CART_NOT_FOUND");
    });
  });

  // =========================================================================
  // Scenario 4: Cart lifecycle protection
  // =========================================================================
  describe("Scenario 4: Cart lifecycle protection", () => {
    let submittedCartId: string;
    let cancelledCartId: string;

    beforeAll(async () => {
      // Re-establish mocks for beforeAll
      mockValidateExternalRequest.mockResolvedValue({ authenticated: true });
      mockGetMenuItemsTaxConfigIds.mockResolvedValue(new Map());
      mockGetTaxConfigsByIds.mockResolvedValue([]);
      mockGetMerchantTaxRateMap.mockResolvedValue(new Map());

      // Create and checkout a cart
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
          salesChannel: "phone_order",
        })
      );
      submittedCartId = (await createRes.json()).data.id;

      await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${submittedCartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: BURGER_ID,
          quantity: 1,
        }),
        createRouteContext({ cartId: submittedCartId })
      );

      setupOrderCreationMocks();
      await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${submittedCartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Lifecycle",
          customerLastName: "Test",
          customerPhone: "555-0400",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId: submittedCartId })
      );

      // Re-establish tax mocks after checkout
      mockGetMenuItemsTaxConfigIds.mockResolvedValue(new Map());
      mockGetTaxConfigsByIds.mockResolvedValue([]);
      mockGetMerchantTaxRateMap.mockResolvedValue(new Map());

      // Create and cancel a cart
      const cancelCartRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
          salesChannel: "phone_order",
        })
      );
      cancelledCartId = (await cancelCartRes.json()).data.id;

      // Cancel it directly via DB since there is no cancel cart API that keeps it "cancelled"
      await prisma.cart.update({
        where: { id: cancelledCartId },
        data: { status: "cancelled" },
      });
    });

    it("should return CART_NOT_ACTIVE when adding item to submitted cart", async () => {
      const res = await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${submittedCartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: FRIES_ID,
          quantity: 1,
        }),
        createRouteContext({ cartId: submittedCartId })
      );
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CART_NOT_ACTIVE");
    });

    it("should return CART_NOT_ACTIVE when updating item in submitted cart", async () => {
      const fakeItemId = generateEntityId();
      const res = await updateCartItem(
        createJsonRequest(`/api/external/v1/carts/${submittedCartId}/items/${fakeItemId}`, "PATCH", {
          tenantId: TENANT_ID,
          quantity: 5,
        }),
        createRouteContext({ cartId: submittedCartId, itemId: fakeItemId })
      );
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CART_NOT_ACTIVE");
    });

    it("should return CART_NOT_ACTIVE when deleting item from submitted cart", async () => {
      const fakeItemId = generateEntityId();
      const res = await deleteCartItem(
        createJsonRequest(`/api/external/v1/carts/${submittedCartId}/items/${fakeItemId}`, "DELETE", {
          tenantId: TENANT_ID,
        }),
        createRouteContext({ cartId: submittedCartId, itemId: fakeItemId })
      );
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CART_NOT_ACTIVE");
    });

    it("should return same orderId idempotently when checking out submitted cart again", async () => {
      // First checkout already happened in beforeAll. Capture its details by
      // fetching the submitted cart's orderId from the DB.
      const firstCart = await prisma.cart.findUnique({
        where: { id: submittedCartId },
      });
      const firstOrderId = firstCart?.orderId;
      expect(firstOrderId).toBeTruthy();

      const sequenceCallsBefore = mockGetNextOrderSequence.mock.calls.length;

      // Second checkout on the same submitted cart
      const res = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${submittedCartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Double",
          customerLastName: "Checkout",
          customerPhone: "555-0401",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId: submittedCartId })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.orderId).toBe(firstOrderId);
      expect(body.data.orderNumber).toBeTruthy();
      // Proves no second order was created
      expect(mockGetNextOrderSequence.mock.calls.length).toBe(sequenceCallsBefore);
    });

    it("should return CART_NOT_ACTIVE when adding item to cancelled cart", async () => {
      const res = await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cancelledCartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: COKE_ID,
          quantity: 1,
        }),
        createRouteContext({ cartId: cancelledCartId })
      );
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CART_NOT_ACTIVE");
    });

    it("should return same orderId on third and fourth duplicate checkouts", async () => {
      const firstCart = await prisma.cart.findUnique({
        where: { id: submittedCartId },
      });
      const firstOrderId = firstCart?.orderId;
      const sequenceCallsBefore = mockGetNextOrderSequence.mock.calls.length;

      const res3 = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${submittedCartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Third",
          customerLastName: "Attempt",
          customerPhone: "555-0402",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId: submittedCartId })
      );
      const res4 = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${submittedCartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Fourth",
          customerLastName: "Attempt",
          customerPhone: "555-0403",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId: submittedCartId })
      );

      const body3 = await res3.json();
      const body4 = await res4.json();

      expect(res3.status).toBe(200);
      expect(res4.status).toBe(200);
      expect(body3.data.orderId).toBe(firstOrderId);
      expect(body4.data.orderId).toBe(firstOrderId);
      expect(mockGetNextOrderSequence.mock.calls.length).toBe(sequenceCallsBefore);
    });

    it("should preserve original customer info when duplicate body differs", async () => {
      // Setup: create a fresh cart + first checkout as Alice/pickup
      const freshCartRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
          salesChannel: "phone_order",
        })
      );
      const freshCartId = (await freshCartRes.json()).data.id;

      await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${freshCartId}/items`, "POST", {
          tenantId: TENANT_ID,
          menuItemId: BURGER_ID,
          quantity: 1,
        }),
        createRouteContext({ cartId: freshCartId })
      );

      setupOrderCreationMocks();
      const firstRes = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${freshCartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Alice",
          customerLastName: "Original",
          customerPhone: "555-0410",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId: freshCartId })
      );
      const firstBody = await firstRes.json();
      expect(firstRes.status).toBe(201);
      const originalOrderId = firstBody.data.orderId;

      // Re-establish tax mocks after setupOrderCreationMocks
      mockGetMenuItemsTaxConfigIds.mockResolvedValue(new Map());
      mockGetTaxConfigsByIds.mockResolvedValue([]);
      mockGetMerchantTaxRateMap.mockResolvedValue(new Map());

      // Second checkout with Bob/delivery
      const secondRes = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${freshCartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Bob",
          customerLastName: "Different",
          customerPhone: "555-0411",
          orderMode: "delivery",
          deliveryAddress: {
            street: "1 Elsewhere",
            city: "Somewhere",
            state: "CA",
            zipCode: "99999",
          },
        }),
        createRouteContext({ cartId: freshCartId })
      );
      const secondBody = await secondRes.json();
      expect(secondRes.status).toBe(200);
      expect(secondBody.data.orderId).toBe(originalOrderId);

      // Verify DB retained Alice, not Bob
      const order = await prisma.order.findUnique({
        where: { id: originalOrderId },
      });
      expect(order?.customerFirstName).toBe("Alice");
      expect(order?.orderMode).toBe("pickup");
    });

    it("should return CART_NOT_ACTIVE for duplicate checkout on cancelled cart", async () => {
      // cancelledCartId has no orderId — no idempotent reply available
      const res = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${cancelledCartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Cancel",
          customerLastName: "Redo",
          customerPhone: "555-0412",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId: cancelledCartId })
      );
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CART_NOT_ACTIVE");
    });
  });

  // =========================================================================
  // Scenario 5: Concurrent add items to same cart
  // =========================================================================
  describe("Scenario 5: Concurrent add items to same cart", () => {
    it("should handle 3 concurrent addItem calls and have all 3 items in cart", async () => {
      // Create cart
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
          salesChannel: "phone_order",
        })
      );
      const cartId = (await createRes.json()).data.id;

      // Fire 3 addItem calls concurrently
      const [res1, res2, res3] = await Promise.all([
        addCartItem(
          createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
            tenantId: TENANT_ID,
            menuItemId: BURGER_ID,
            quantity: 1,
          }),
          createRouteContext({ cartId })
        ),
        addCartItem(
          createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
            tenantId: TENANT_ID,
            menuItemId: FRIES_ID,
            quantity: 1,
          }),
          createRouteContext({ cartId })
        ),
        addCartItem(
          createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
            tenantId: TENANT_ID,
            menuItemId: COKE_ID,
            quantity: 1,
          }),
          createRouteContext({ cartId })
        ),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res3.status).toBe(201);

      // Get cart — verify all 3 items exist
      const getRes = await getCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}?tenantId=${TENANT_ID}`, "GET"),
        createRouteContext({ cartId })
      );
      const getBody = await getRes.json();
      expect(getBody.data.items).toHaveLength(3);

      // Verify summary is correct: 12.99 + 4.99 + 2.49 = 20.47
      expect(getBody.data.summary.subtotal).toBe(20.47);
    });
  });

  // =========================================================================
  // Scenario 6: Concurrent checkout (race condition)
  // =========================================================================
  describe("Scenario 6: Concurrent checkout (race condition)", () => {
    it("should return same orderId for both concurrent checkouts", async () => {
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
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
      let seqCounter = 100;
      mockGetNextOrderSequence.mockImplementation(() => Promise.resolve(seqCounter++));
      const sequenceCallsBefore = mockGetNextOrderSequence.mock.calls.length;

      const [checkout1, checkout2] = await Promise.all([
        checkoutCart(
          createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
            tenantId: TENANT_ID,
            customerFirstName: "Race",
            customerLastName: "One",
            customerPhone: "555-0601",
            orderMode: "pickup",
          }),
          createRouteContext({ cartId })
        ),
        checkoutCart(
          createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
            tenantId: TENANT_ID,
            customerFirstName: "Race",
            customerLastName: "Two",
            customerPhone: "555-0602",
            orderMode: "pickup",
          }),
          createRouteContext({ cartId })
        ),
      ]);

      const body1 = await checkout1.json();
      const body2 = await checkout2.json();

      expect(body1.success).toBe(true);
      expect(body2.success).toBe(true);
      expect(body1.data.orderId).toBe(body2.data.orderId);

      // Exactly one 201, one 200 — in either order
      const statuses = [checkout1.status, checkout2.status].sort();
      expect(statuses).toEqual([200, 201]);

      // DB has exactly one order for this cart's flow (one new sequence call)
      expect(mockGetNextOrderSequence.mock.calls.length - sequenceCallsBefore).toBe(1);
    });

    it("should converge 5 concurrent checkouts to a single orderId", async () => {
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
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
      let seqCounter = 200;
      mockGetNextOrderSequence.mockImplementation(() => Promise.resolve(seqCounter++));
      const sequenceCallsBefore = mockGetNextOrderSequence.mock.calls.length;

      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          checkoutCart(
            createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
              tenantId: TENANT_ID,
              customerFirstName: `Racer${i}`,
              customerLastName: "Concurrent",
              customerPhone: `555-061${i}`,
              orderMode: "pickup",
            }),
            createRouteContext({ cartId })
          )
        )
      );

      const bodies = await Promise.all(responses.map((r) => r.json()));
      const orderIds = new Set(bodies.map((b) => b.data.orderId));

      expect(bodies.every((b) => b.success === true)).toBe(true);
      expect(orderIds.size).toBe(1);

      const statuses = responses.map((r) => r.status).sort();
      // Exactly one 201, four 200s
      expect(statuses).toEqual([200, 200, 200, 200, 201]);

      expect(mockGetNextOrderSequence.mock.calls.length - sequenceCallsBefore).toBe(1);
    });

    it("should retry and create new order when peer checkout rolls back", async () => {
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
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

      // First checkout: force a failure inside createMerchantOrderAtomic by
      // making menu lookup reject once
      setupOrderCreationMocks();
      mockGetMenuItemsByIds.mockRejectedValueOnce(new Error("simulated failure"));

      const failedRes = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Fail",
          customerLastName: "First",
          customerPhone: "555-0620",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId })
      );
      expect(failedRes.status).not.toBe(201);
      expect(failedRes.status).not.toBe(200);

      // Verify cart was rolled back to active
      const rolledBack = await prisma.cart.findUnique({ where: { id: cartId } });
      expect(rolledBack?.status).toBe("active");
      expect(rolledBack?.orderId).toBeNull();

      // Second checkout: succeeds
      const successRes = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Retry",
          customerLastName: "Second",
          customerPhone: "555-0621",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId })
      );
      expect(successRes.status).toBe(201);
      const body = await successRes.json();
      expect(body.success).toBe(true);

      const finalCart = await prisma.cart.findUnique({ where: { id: cartId } });
      expect(finalCart?.status).toBe("submitted");
      expect(finalCart?.orderId).toBe(body.data.orderId);
    });
  });

  // =========================================================================
  // Scenario 7: Merchant B without phoneAiSettings
  // =========================================================================
  describe("Scenario 7: Merchant B without phoneAiSettings", () => {
    it("should lookup merchant B with no forwardPhone", async () => {
      const lookupRes = await lookupMerchant(
        createJsonRequest("/api/external/v1/merchants/lookup", "POST", {
          phone: MERCHANT_B_AI_PHONE,
        }),
        createRouteContext({})
      );
      expect(lookupRes.status).toBe(200);
      const lookupBody = await lookupRes.json();
      expect(lookupBody.success).toBe(true);
      expect(lookupBody.data.merchantId).toBe(MERCHANT_B_ID);
      expect(lookupBody.data.merchantName).toBe("Pizza Place");
      // No forwardPhone since no phoneAiSettings
      expect(lookupBody.data.forwardPhone).toBeNull();
    });

    it("should return null for GREETINGS, FAQ, AGENT_WORK_SWITCH", async () => {
      setupMerchantServiceMock(MERCHANT_A_DATA, MERCHANT_B_DATA);

      const res = await queryKnowledge(
        createJsonRequest("/api/external/v1/knowledge/query", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_B_ID,
          targets: ["GREETINGS", "FAQ", "AGENT_WORK_SWITCH"],
        }),
        createRouteContext({})
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.knowledgeMap.GREETINGS).toBeNull();
      expect(body.data.knowledgeMap.FAQ).toBeNull();
      expect(body.data.knowledgeMap.AGENT_WORK_SWITCH).toBeNull();
    });
  });

  // =========================================================================
  // Scenario 8: Cross-tenant cart isolation
  // =========================================================================
  describe("Scenario 8: Cross-tenant cart isolation", () => {
    let cartId: string;

    beforeAll(async () => {
      // Re-establish mocks for beforeAll
      mockValidateExternalRequest.mockResolvedValue({ authenticated: true });
      mockGetMenuItemsTaxConfigIds.mockResolvedValue(new Map());
      mockGetTaxConfigsByIds.mockResolvedValue([]);
      mockGetMerchantTaxRateMap.mockResolvedValue(new Map());

      // Create cart for merchant A under TENANT_ID
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
          salesChannel: "phone_order",
        })
      );
      cartId = (await createRes.json()).data.id;
    });

    it("should return CART_NOT_FOUND when getting cart with different tenantId", async () => {
      const res = await getCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}?tenantId=${OTHER_TENANT_ID}`, "GET"),
        createRouteContext({ cartId })
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CART_NOT_FOUND");
    });

    it("should return CART_NOT_FOUND when adding item with different tenantId", async () => {
      const res = await addCartItem(
        createJsonRequest(`/api/external/v1/carts/${cartId}/items`, "POST", {
          tenantId: OTHER_TENANT_ID,
          menuItemId: BURGER_ID,
          quantity: 1,
        }),
        createRouteContext({ cartId })
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CART_NOT_FOUND");
    });
  });

  // =========================================================================
  // Scenario 9: HTTP status semantics (201 first, 200 idempotent)
  // =========================================================================
  describe("Scenario 9: HTTP status semantics", () => {
    it("should return 201 on first checkout and 200 on idempotent retry", async () => {
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
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

      const first = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Status",
          customerLastName: "First",
          customerPhone: "555-0900",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId })
      );
      expect(first.status).toBe(201);

      mockGetMenuItemsTaxConfigIds.mockResolvedValue(new Map());
      mockGetTaxConfigsByIds.mockResolvedValue([]);
      mockGetMerchantTaxRateMap.mockResolvedValue(new Map());

      const second = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Status",
          customerLastName: "Retry",
          customerPhone: "555-0901",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId })
      );
      expect(second.status).toBe(200);
    });
  });

  // =========================================================================
  // Scenario 10: Cross-tenant isolation of idempotency
  // =========================================================================
  describe("Scenario 10: Cross-tenant idempotency isolation", () => {
    it("should return CART_NOT_FOUND when duplicate checkout comes from different tenant", async () => {
      const createRes = await createCart(
        createJsonRequest("/api/external/v1/carts", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
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
      const first = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
          tenantId: TENANT_ID,
          customerFirstName: "Tenant",
          customerLastName: "A",
          customerPhone: "555-1000",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId })
      );
      expect(first.status).toBe(201);

      // Attempt duplicate checkout under OTHER_TENANT_ID — should be blocked
      // before any idempotency check
      const crossTenant = await checkoutCart(
        createJsonRequest(`/api/external/v1/carts/${cartId}/checkout`, "POST", {
          tenantId: OTHER_TENANT_ID,
          customerFirstName: "Tenant",
          customerLastName: "B",
          customerPhone: "555-1001",
          orderMode: "pickup",
        }),
        createRouteContext({ cartId })
      );
      expect(crossTenant.status).toBe(404);
      const body = await crossTenant.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CART_NOT_FOUND");
    });
  });
});
