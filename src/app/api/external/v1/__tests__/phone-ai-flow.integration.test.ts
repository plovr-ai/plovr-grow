/**
 * Phone-AI External API — Integration Tests
 *
 * Tests the complete phone-AI flow through route handlers with a real database.
 * Scenarios cover the actual business workflow when phone-AI handles a call:
 * 1. Call initialization: lookup merchant → query knowledge → get order URL
 * 2. Send order link via SMS: lookup → generate link → send SMS
 * 3. Phone number normalization across the flow
 * 4. Tenant isolation between merchants
 * 5. Unknown phone number handling
 * 6. Knowledge query with unsupported targets
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

// Mock merchantService (used by online-order-url, links/generate, knowledge/query)
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

// Mock menuService (used by knowledge/query for MENU target)
const mockGetMenu = vi.fn();
vi.mock("@/services/menu", () => ({
  menuService: {
    getMenu: (...args: unknown[]) => mockGetMenu(...args),
  },
}));

// Mock smsService (used by sms/send)
const mockSendMessage = vi.fn();
vi.mock("@/services/sms/sms.service", () => ({
  smsService: {
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
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
// Stub env
// ---------------------------------------------------------------------------

vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://www.mypeppr.com");

// ---------------------------------------------------------------------------
// Import route handlers AFTER mocks
// ---------------------------------------------------------------------------

import { POST as lookupMerchant } from "../merchants/lookup/route";
import { GET as getOnlineOrderUrl } from "../merchants/online-order-url/route";
import { POST as sendSms } from "../sms/send/route";
import { POST as generateLink } from "../links/generate/route";
import { POST as queryKnowledge } from "../knowledge/query/route";

const dummyContext = { params: Promise.resolve({}) };

// ---------------------------------------------------------------------------
// Test IDs
// ---------------------------------------------------------------------------

const TENANT_ID = generateEntityId();
const MERCHANT_A_ID = generateEntityId();
const MERCHANT_B_ID = generateEntityId();
const MENU_ID = generateEntityId();
const CATEGORY_ID = generateEntityId();
const ITEM_KUNG_PAO_ID = generateEntityId();
const ITEM_FRIED_RICE_ID = generateEntityId();
const CATEGORY_ITEM_KUNG_PAO_ID = generateEntityId();
const CATEGORY_ITEM_FRIED_RICE_ID = generateEntityId();

const timestamp = Date.now();
const MERCHANT_A_SLUG = `happy-wok-${timestamp}`;
const MERCHANT_B_SLUG = `sushi-bar-${timestamp}`;
const MERCHANT_A_AI_PHONE = "+14155550001";
const MERCHANT_B_AI_PHONE = "+14155550002";

// ---------------------------------------------------------------------------
// Merchant data matching seed (for merchantService mock)
// ---------------------------------------------------------------------------

const MERCHANT_A_DATA = {
  id: MERCHANT_A_ID,
  slug: MERCHANT_A_SLUG,
  name: "Happy Wok",
  tenantId: TENANT_ID,
  address: "123 Main St",
  city: "San Francisco",
  state: "CA",
  zipCode: "94102",
  country: "US",
  phone: "+14155559000",
  email: "info@happywok.test",
  timezone: "America/Los_Angeles",
  currency: "USD",
  locale: "en-US",
  status: "active",
  businessHours: {
    monday: { open: "11:00", close: "21:00" },
    tuesday: { open: "11:00", close: "21:00" },
    wednesday: { open: "11:00", close: "21:00" },
    thursday: { open: "11:00", close: "21:00" },
    friday: { open: "11:00", close: "22:00" },
    saturday: { open: "12:00", close: "22:00" },
    sunday: { open: "12:00", close: "20:00" },
  },
  settings: {
    acceptsPickup: true,
    acceptsDelivery: false,
    minimumOrderAmount: 15,
    estimatedPrepTime: 20,
  },
  phoneAiSettings: {
    greetings: "Welcome to Happy Wok!",
    faq: {
      savedFaqs: [
        { question: "Are you open?", answer: "Yes, we are open every day." },
      ],
      customFaqs: [],
    },
    agentWorkSwitch: "0",
    forwardPhone: "+14155559999",
  },
  tenant: {
    id: TENANT_ID,
    slug: `phone-ai-test-${timestamp}`,
    tenantId: TENANT_ID,
    name: "Phone AI Test Tenant",
  },
};

const MERCHANT_B_DATA = {
  id: MERCHANT_B_ID,
  slug: MERCHANT_B_SLUG,
  name: "Sushi Bar",
  tenantId: TENANT_ID,
  address: "456 Oak Ave",
  city: "San Francisco",
  state: "CA",
  zipCode: "94103",
  country: "US",
  phone: "+14155559001",
  email: "info@sushibar.test",
  timezone: "America/Los_Angeles",
  currency: "USD",
  locale: "en-US",
  status: "active",
  businessHours: {
    monday: { open: "12:00", close: "22:00" },
    tuesday: { open: "12:00", close: "22:00" },
    wednesday: { open: "12:00", close: "22:00" },
    thursday: { open: "12:00", close: "22:00" },
    friday: { open: "12:00", close: "23:00" },
    saturday: { open: "11:00", close: "23:00" },
    sunday: { open: "11:00", close: "21:00" },
  },
  settings: {
    acceptsPickup: true,
    acceptsDelivery: true,
    minimumOrderAmount: 20,
    estimatedPrepTime: 30,
  },
  phoneAiSettings: null,
  tenant: {
    id: TENANT_ID,
    slug: `phone-ai-test-${timestamp}`,
    tenantId: TENANT_ID,
    name: "Phone AI Test Tenant",
  },
};

const MOCK_MENU_DATA = {
  categories: [
    {
      id: CATEGORY_ID,
      name: "Entrees",
      items: [
        { id: ITEM_KUNG_PAO_ID, name: "Kung Pao Chicken", price: 14.99 },
        { id: ITEM_FRIED_RICE_ID, name: "Fried Rice", price: 10.99 },
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

function setupMerchantServiceMock(
  ...merchants: (typeof MERCHANT_A_DATA)[]
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
      name: "Phone AI Test Tenant",
      slug: `phone-ai-test-${timestamp}`,
    },
  });

  await prisma.merchant.createMany({
    data: [
      {
        id: MERCHANT_A_ID,
        tenantId: TENANT_ID,
        slug: MERCHANT_A_SLUG,
        name: "Happy Wok",
        aiPhone: MERCHANT_A_AI_PHONE,
        address: "123 Main St",
        city: "San Francisco",
        state: "CA",
        zipCode: "94102",
        phone: "+14155559000",
        email: "info@happywok.test",
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
        name: "Sushi Bar",
        aiPhone: MERCHANT_B_AI_PHONE,
        address: "456 Oak Ave",
        city: "San Francisco",
        state: "CA",
        zipCode: "94103",
        phone: "+14155559001",
        email: "info@sushibar.test",
        timezone: "America/Los_Angeles",
        currency: "USD",
        locale: "en-US",
        businessHours: JSON.parse(JSON.stringify(MERCHANT_B_DATA.businessHours)),
        settings: JSON.parse(JSON.stringify(MERCHANT_B_DATA.settings)),
      },
    ],
  });

  // Menu data for knowledge query
  await prisma.menu.create({
    data: { id: MENU_ID, tenantId: TENANT_ID, name: "Happy Wok Menu" },
  });

  await prisma.menuCategory.create({
    data: { id: CATEGORY_ID, tenantId: TENANT_ID, menuId: MENU_ID, name: "Entrees" },
  });

  await prisma.menuItem.createMany({
    data: [
      { id: ITEM_KUNG_PAO_ID, tenantId: TENANT_ID, name: "Kung Pao Chicken", price: 14.99 },
      { id: ITEM_FRIED_RICE_ID, tenantId: TENANT_ID, name: "Fried Rice", price: 10.99 },
    ],
  });

  await prisma.menuCategoryItem.createMany({
    data: [
      { id: CATEGORY_ITEM_KUNG_PAO_ID, tenantId: TENANT_ID, categoryId: CATEGORY_ID, menuItemId: ITEM_KUNG_PAO_ID },
      { id: CATEGORY_ITEM_FRIED_RICE_ID, tenantId: TENANT_ID, categoryId: CATEGORY_ID, menuItemId: ITEM_FRIED_RICE_ID },
    ],
  });
}

async function cleanupTestData() {
  await prisma.menuCategoryItem.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menuItem.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menuCategory.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menu.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.merchant.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("Phone-AI External API — Call Flow", () => {
  beforeAll(async () => {
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockValidateExternalRequest.mockClear();
    mockGetMerchantById.mockReset();
    mockGetMenu.mockReset();
    mockSendMessage.mockReset();
    // Re-establish auth mock
    mockValidateExternalRequest.mockResolvedValue({ authenticated: true });
  });

  // =========================================================================
  // Scenario 1: Phone-AI call initialization
  // When a call arrives, phone-AI: lookup merchant → query knowledge → get order URL
  // =========================================================================
  describe("Scenario 1: Phone-AI call initialization", () => {
    it("should lookup merchant, query knowledge context, and get order URL", async () => {
      // Step 1: Lookup merchant by incoming phone number
      const lookupRes = await lookupMerchant(
        createJsonRequest("/api/external/v1/merchants/lookup", "POST", {
          phone: MERCHANT_A_AI_PHONE,
        }),
        dummyContext
      );
      expect(lookupRes.status).toBe(200);
      const lookupBody = await lookupRes.json();
      expect(lookupBody.success).toBe(true);
      expect(lookupBody.data.tenantId).toBe(TENANT_ID);
      expect(lookupBody.data.merchantId).toBe(MERCHANT_A_ID);
      expect(lookupBody.data.merchantName).toBe("Happy Wok");
      expect(lookupBody.data.address).toBe("123 Main St");
      expect(lookupBody.data.city).toBe("San Francisco");
      expect(lookupBody.data.forwardPhone).toBe("+14155559999");

      const { tenantId, merchantId } = lookupBody.data;

      // Step 2: Query knowledge to build AI context
      setupMerchantServiceMock(MERCHANT_A_DATA);
      mockGetMenu.mockResolvedValue(MOCK_MENU_DATA);

      const knowledgeRes = await queryKnowledge(
        createJsonRequest("/api/external/v1/knowledge/query", "POST", {
          tenantId,
          merchantId,
          targets: ["RESTAURANT_INFO", "OPENING_HOURS", "ORDER_CONFIG", "MENU"],
        }),
        dummyContext
      );
      expect(knowledgeRes.status).toBe(200);
      const knowledgeBody = await knowledgeRes.json();
      expect(knowledgeBody.success).toBe(true);

      // Verify knowledge data matches seeded merchant
      const restaurantInfo = JSON.parse(knowledgeBody.data.knowledgeMap.RESTAURANT_INFO.data);
      expect(restaurantInfo.name).toBe("Happy Wok");
      expect(restaurantInfo.address).toBe("123 Main St");
      expect(restaurantInfo.city).toBe("San Francisco");
      expect(restaurantInfo.timezone).toBe("America/Los_Angeles");

      const hours = JSON.parse(knowledgeBody.data.knowledgeMap.OPENING_HOURS.data);
      expect(hours.monday.open).toBe("11:00");
      expect(hours.friday.close).toBe("22:00");

      const orderConfig = JSON.parse(knowledgeBody.data.knowledgeMap.ORDER_CONFIG.data);
      expect(orderConfig.minimumOrderAmount).toBe(15);
      expect(orderConfig.estimatedPrepTime).toBe(20);
      expect(orderConfig.acceptsPickup).toBe(true);
      expect(orderConfig.acceptsDelivery).toBe(false);

      // MENU target should have called menuService
      expect(mockGetMenu).toHaveBeenCalledWith(tenantId, merchantId);
      expect(knowledgeBody.data.knowledgeMap.MENU).not.toBeNull();

      // Step 3: Get online order URL (to potentially send to customer later)
      const urlRes = await getOnlineOrderUrl(
        createJsonRequest(
          `/api/external/v1/merchants/online-order-url?tenantId=${tenantId}&merchantId=${merchantId}`,
          "GET"
        ),
        dummyContext
      );
      expect(urlRes.status).toBe(200);
      const urlBody = await urlRes.json();
      expect(urlBody.success).toBe(true);
      expect(urlBody.data.onlineOrderUrl).toBe(
        `https://www.mypeppr.com/r/${MERCHANT_A_SLUG}/order`
      );
    });
  });

  // =========================================================================
  // Scenario 2: AI sends order link via SMS
  // Phone-AI: lookup → generate link → send SMS with the link
  // =========================================================================
  describe("Scenario 2: AI sends order link via SMS", () => {
    it("should lookup merchant, generate ordering link, and send it via SMS", async () => {
      const customerPhone = "+14155558888";

      // Step 1: Lookup merchant
      const lookupRes = await lookupMerchant(
        createJsonRequest("/api/external/v1/merchants/lookup", "POST", {
          phone: MERCHANT_A_AI_PHONE,
        }),
        dummyContext
      );
      expect(lookupRes.status).toBe(200);
      const { tenantId, merchantId } = (await lookupRes.json()).data;

      // Step 2: Generate ordering link
      setupMerchantServiceMock(MERCHANT_A_DATA);

      const linkRes = await generateLink(
        createJsonRequest("/api/external/v1/links/generate", "POST", {
          tenantId,
          merchantId,
        }),
        dummyContext
      );
      expect(linkRes.status).toBe(200);
      const linkBody = await linkRes.json();
      expect(linkBody.success).toBe(true);
      const orderUrl = linkBody.data.url;
      expect(orderUrl).toBe(`https://www.mypeppr.com/r/${MERCHANT_A_SLUG}/order`);

      // Step 3: Send SMS with the link
      mockSendMessage.mockResolvedValue({ success: true, messageId: "msg_12345" });

      const smsRes = await sendSms(
        createJsonRequest("/api/external/v1/sms/send", "POST", {
          tenantId,
          merchantId,
          mobile: customerPhone,
          message: `Order online here: ${orderUrl}`,
        }),
        dummyContext
      );
      expect(smsRes.status).toBe(200);
      const smsBody = await smsRes.json();
      expect(smsBody.success).toBe(true);
      expect(smsBody.data.messageId).toBe("msg_12345");

      // Verify SMS was called with customer phone and message containing the link
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(
        customerPhone,
        expect.stringContaining(orderUrl)
      );
    });
  });

  // =========================================================================
  // Scenario 3: Phone number normalization
  // Phone-AI may receive numbers with or without + prefix
  // =========================================================================
  describe("Scenario 3: Phone number normalization across the flow", () => {
    it("should find same merchant regardless of + prefix", async () => {
      // Lookup with +14155550001
      const res1 = await lookupMerchant(
        createJsonRequest("/api/external/v1/merchants/lookup", "POST", {
          phone: "+14155550001",
        }),
        dummyContext
      );
      expect(res1.status).toBe(200);
      const data1 = (await res1.json()).data;

      // Lookup with 14155550001 (no plus)
      const res2 = await lookupMerchant(
        createJsonRequest("/api/external/v1/merchants/lookup", "POST", {
          phone: "14155550001",
        }),
        dummyContext
      );
      expect(res2.status).toBe(200);
      const data2 = (await res2.json()).data;

      // Both should return the same merchant
      expect(data1.tenantId).toBe(data2.tenantId);
      expect(data1.merchantId).toBe(data2.merchantId);
      expect(data1.merchantName).toBe(data2.merchantName);
      expect(data1.merchantId).toBe(MERCHANT_A_ID);
    });
  });

  // =========================================================================
  // Scenario 4: Tenant isolation
  // Two merchants exist — verify they are correctly isolated
  // =========================================================================
  describe("Scenario 4: Tenant isolation", () => {
    it("should return correct merchant for each phone number", async () => {
      // Lookup merchant A
      const resA = await lookupMerchant(
        createJsonRequest("/api/external/v1/merchants/lookup", "POST", {
          phone: MERCHANT_A_AI_PHONE,
        }),
        dummyContext
      );
      expect(resA.status).toBe(200);
      const dataA = (await resA.json()).data;
      expect(dataA.merchantId).toBe(MERCHANT_A_ID);
      expect(dataA.merchantName).toBe("Happy Wok");

      // Lookup merchant B
      const resB = await lookupMerchant(
        createJsonRequest("/api/external/v1/merchants/lookup", "POST", {
          phone: MERCHANT_B_AI_PHONE,
        }),
        dummyContext
      );
      expect(resB.status).toBe(200);
      const dataB = (await resB.json()).data;
      expect(dataB.merchantId).toBe(MERCHANT_B_ID);
      expect(dataB.merchantName).toBe("Sushi Bar");

      // They are different merchants
      expect(dataA.merchantId).not.toBe(dataB.merchantId);
    });

    it("should return 404 for knowledge query with wrong tenantId", async () => {
      const wrongTenantId = generateEntityId();
      setupMerchantServiceMock(MERCHANT_A_DATA);

      const res = await queryKnowledge(
        createJsonRequest("/api/external/v1/knowledge/query", "POST", {
          tenantId: wrongTenantId,
          merchantId: MERCHANT_A_ID,
          targets: ["RESTAURANT_INFO"],
        }),
        dummyContext
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("MERCHANT_NOT_FOUND");
    });

    it("should return 404 for online order URL with wrong tenantId", async () => {
      const wrongTenantId = generateEntityId();
      setupMerchantServiceMock(MERCHANT_A_DATA);

      const res = await getOnlineOrderUrl(
        createJsonRequest(
          `/api/external/v1/merchants/online-order-url?tenantId=${wrongTenantId}&merchantId=${MERCHANT_A_ID}`,
          "GET"
        ),
        dummyContext
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  // =========================================================================
  // Scenario 5: Unknown phone number
  // Phone-AI receives a call from an unknown number — flow cannot proceed
  // =========================================================================
  describe("Scenario 5: Unknown phone number", () => {
    it("should return 404 when no merchant has the given phone", async () => {
      const res = await lookupMerchant(
        createJsonRequest("/api/external/v1/merchants/lookup", "POST", {
          phone: "+19999999999",
        }),
        dummyContext
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("MERCHANT_NOT_FOUND");
    });
  });

  // =========================================================================
  // Scenario 6: Knowledge query — unsupported targets return null
  // Phone-AI queries mix of supported and unsupported targets
  // =========================================================================
  describe("Scenario 6: Knowledge targets including phoneAiSettings-based ones", () => {
    it("should return data for all configured targets", async () => {
      setupMerchantServiceMock(MERCHANT_A_DATA);
      mockGetMenu.mockResolvedValue(MOCK_MENU_DATA);

      const res = await queryKnowledge(
        createJsonRequest("/api/external/v1/knowledge/query", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_A_ID,
          targets: ["MENU", "RESTAURANT_INFO", "FAQ", "GREETINGS", "SERVICE_PROVIDED", "AGENT_WORK_SWITCH"],
        }),
        dummyContext
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // All targets should have data (merchant A has phoneAiSettings)
      expect(body.data.knowledgeMap.MENU).not.toBeNull();
      expect(body.data.knowledgeMap.RESTAURANT_INFO).not.toBeNull();
      expect(body.data.knowledgeMap.GREETINGS).toEqual({
        data: "Welcome to Happy Wok!",
      });
      const faq = JSON.parse(body.data.knowledgeMap.FAQ.data);
      expect(faq.savedFaqs).toHaveLength(1);
      expect(faq.savedFaqs[0].question).toBe("Are you open?");
      expect(body.data.knowledgeMap.AGENT_WORK_SWITCH).toEqual({
        data: "0",
      });

      // SERVICE_PROVIDED derived from merchant settings
      const service = JSON.parse(body.data.knowledgeMap.SERVICE_PROVIDED.data);
      expect(service.pickup.openSwitch).toBe(1);
      expect(service.pickup.pickupHoursMode).toBe(1);
      expect(service.pickup.quoteTime.min).toBe(20);
      expect(service.delivery.openSwitch).toBe(0);
      expect(service.reservation.openSwitch).toBe(0);

      // Response has all 6 keys
      expect(Object.keys(body.data.knowledgeMap)).toHaveLength(6);
    });

    it("should return null for GREETINGS/FAQ/AGENT_WORK_SWITCH when phoneAiSettings is missing", async () => {
      const merchantNoPhoneAi = { ...MERCHANT_B_DATA } as unknown as typeof MERCHANT_A_DATA;
      setupMerchantServiceMock(MERCHANT_A_DATA, merchantNoPhoneAi);

      const res = await queryKnowledge(
        createJsonRequest("/api/external/v1/knowledge/query", "POST", {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_B_ID,
          targets: ["GREETINGS", "FAQ", "AGENT_WORK_SWITCH"],
        }),
        dummyContext
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.knowledgeMap.GREETINGS).toBeNull();
      expect(body.data.knowledgeMap.FAQ).toBeNull();
      expect(body.data.knowledgeMap.AGENT_WORK_SWITCH).toBeNull();
    });
  });
});
