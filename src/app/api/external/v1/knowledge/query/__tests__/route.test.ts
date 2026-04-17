import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockValidateExternalRequest = vi.fn();
const mockGetMerchantById = vi.fn();
const mockGetMenu = vi.fn();

vi.mock("@/lib/external-auth", () => ({
  validateExternalRequest: (...args: unknown[]) => mockValidateExternalRequest(...args),
}));

vi.mock("@/services/merchant", () => ({
  merchantService: {
    getMerchantById: (...args: unknown[]) => mockGetMerchantById(...args),
  },
}));

vi.mock("@/services/menu", () => ({
  menuService: {
    getMenu: (...args: unknown[]) => mockGetMenu(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@sentry/nextjs", () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}));

import { POST } from "../route";

const dummyContext = { params: Promise.resolve({}) };

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    new URL("http://localhost/api/external/v1/knowledge/query"),
    { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
  );
}

const mockMerchant = {
  id: "m1",
  tenantId: "t1",
  name: "Happy Wok",
  slug: "happy-wok",
  address: "123 Main St",
  city: "San Francisco",
  state: "CA",
  zipCode: "94102",
  phone: "+14155551234",
  email: "info@happywok.com",
  timezone: "America/Los_Angeles",
  currency: "USD",
  locale: "en-US",
  businessHours: {
    mon: { open: "09:00", close: "22:00" },
    tue: { open: "09:00", close: "22:00" },
    sun: { open: "10:00", close: "20:00", closed: false },
  },
  settings: {
    tipConfig: { enabled: true, presets: [15, 18, 20] },
    feeConfig: { serviceFee: 0 },
  },
  phoneAiSettings: {
    greetings: "Welcome to Happy Wok! How can I help you?",
    faq: [
      { question: "Do you have gluten-free options?", answer: "Yes, we have several gluten-free dishes." },
    ],
    agentWorkSwitch: "transfer_to_human",
  },
};

describe("POST /api/external/v1/knowledge/query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateExternalRequest.mockResolvedValue({ authenticated: true });
  });

  it("should return 401 when not authenticated", async () => {
    mockValidateExternalRequest.mockResolvedValue({ authenticated: false });
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["MENU"] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(401);
    expect(json).toEqual({ success: false, error: { code: "UNAUTHORIZED" } });
  });

  it("should return 400 when targets is empty", async () => {
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: [] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it("should return 400 when targets has invalid value", async () => {
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["INVALID_TARGET"] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it("should return 404 when merchant not found", async () => {
    mockGetMerchantById.mockResolvedValue(null);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["RESTAURANT_INFO"] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json).toEqual({ success: false, error: { code: "MERCHANT_NOT_FOUND" } });
  });

  it("should return RESTAURANT_INFO as JSON string", async () => {
    mockGetMerchantById.mockResolvedValue(mockMerchant);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["RESTAURANT_INFO"] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    const restaurantInfo = JSON.parse(json.data.knowledgeMap.RESTAURANT_INFO.data);
    expect(restaurantInfo.name).toBe("Happy Wok");
    expect(restaurantInfo.address).toBe("123 Main St");
    expect(restaurantInfo.phone).toBe("+14155551234");
  });

  it("should return OPENING_HOURS as JSON string", async () => {
    mockGetMerchantById.mockResolvedValue(mockMerchant);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["OPENING_HOURS"] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(200);
    const hours = JSON.parse(json.data.knowledgeMap.OPENING_HOURS.data);
    expect(hours.mon.open).toBe("09:00");
  });

  it("should return ORDER_CONFIG from merchant settings", async () => {
    mockGetMerchantById.mockResolvedValue(mockMerchant);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["ORDER_CONFIG"] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(200);
    const config = JSON.parse(json.data.knowledgeMap.ORDER_CONFIG.data);
    expect(config.tipConfig.enabled).toBe(true);
  });

  it("should return MENU data from menuService", async () => {
    mockGetMerchantById.mockResolvedValue(mockMerchant);
    mockGetMenu.mockResolvedValue({
      menus: [{ id: "menu1", name: "Main Menu" }],
      categories: [{ id: "cat1", name: "Appetizers", menuItems: [{ id: "item1", name: "Spring Roll", price: 5.99 }] }],
    });
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["MENU"] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(200);
    const menu = JSON.parse(json.data.knowledgeMap.MENU.data);
    expect(menu.menus).toHaveLength(1);
    expect(menu.categories[0].menuItems[0].name).toBe("Spring Roll");
    expect(mockGetMenu).toHaveBeenCalledWith("t1", "m1");
  });

  it("should return GREETINGS from phoneAiSettings", async () => {
    mockGetMerchantById.mockResolvedValue(mockMerchant);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["GREETINGS"] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.knowledgeMap.GREETINGS).toEqual({
      data: "Welcome to Happy Wok! How can I help you?",
    });
  });

  it("should return FAQ from phoneAiSettings as JSON string", async () => {
    mockGetMerchantById.mockResolvedValue(mockMerchant);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["FAQ"] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(200);
    const faq = JSON.parse(json.data.knowledgeMap.FAQ.data);
    expect(faq).toHaveLength(1);
    expect(faq[0].question).toBe("Do you have gluten-free options?");
  });

  it("should return AGENT_WORK_SWITCH from phoneAiSettings", async () => {
    mockGetMerchantById.mockResolvedValue(mockMerchant);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["AGENT_WORK_SWITCH"] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.knowledgeMap.AGENT_WORK_SWITCH).toEqual({
      data: "transfer_to_human",
    });
  });

  it("should return null for GREETINGS when phoneAiSettings is missing", async () => {
    const merchantWithoutPhoneAi = { ...mockMerchant, phoneAiSettings: undefined };
    mockGetMerchantById.mockResolvedValue(merchantWithoutPhoneAi);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["GREETINGS", "FAQ", "AGENT_WORK_SWITCH"] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.knowledgeMap.GREETINGS).toBeNull();
    expect(json.data.knowledgeMap.FAQ).toBeNull();
    expect(json.data.knowledgeMap.AGENT_WORK_SWITCH).toBeNull();
  });

  it("should return SERVICE_PROVIDED derived from merchant settings", async () => {
    const merchantWithServices = {
      ...mockMerchant,
      settings: {
        ...mockMerchant.settings,
        acceptsPickup: true,
        acceptsDelivery: false,
        estimatedPrepTime: 25,
      },
    };
    mockGetMerchantById.mockResolvedValue(merchantWithServices);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["SERVICE_PROVIDED"] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(200);
    const service = JSON.parse(json.data.knowledgeMap.SERVICE_PROVIDED.data);
    expect(service.pickup.openSwitch).toBe(1);
    expect(service.pickup.quoteTime.min).toBe(25);
    expect(service.delivery.openSwitch).toBe(0);
    expect(service.reservation.openSwitch).toBe(0);
  });

  it("should return SERVICE_PROVIDED with defaults when settings is null", async () => {
    const merchantNoSettings = { ...mockMerchant, settings: undefined };
    mockGetMerchantById.mockResolvedValue(merchantNoSettings);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["SERVICE_PROVIDED"] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(200);
    const service = JSON.parse(json.data.knowledgeMap.SERVICE_PROVIDED.data);
    expect(service.pickup.openSwitch).toBe(0);
    expect(service.pickup.quoteTime.min).toBe(15);
    expect(service.delivery.openSwitch).toBe(0);
  });

  it("should only return requested targets", async () => {
    mockGetMerchantById.mockResolvedValue(mockMerchant);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["OPENING_HOURS"] }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(Object.keys(json.data.knowledgeMap)).toEqual(["OPENING_HOURS"]);
  });
});
