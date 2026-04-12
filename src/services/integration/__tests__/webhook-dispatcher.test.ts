import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindWebhookEventByEventId = vi.fn();
const mockGetConnectionByExternalAccountId = vi.fn();
const mockCreateWebhookEvent = vi.fn();
const mockUpdateWebhookEventStatus = vi.fn();
const mockScheduleWebhookEventRetry = vi.fn();

vi.mock("@/repositories/integration.repository", () => ({
  integrationRepository: {
    findWebhookEventByEventId: (...args: unknown[]) =>
      mockFindWebhookEventByEventId(...args),
    getConnectionByExternalAccountId: (...args: unknown[]) =>
      mockGetConnectionByExternalAccountId(...args),
    createWebhookEvent: (...args: unknown[]) =>
      mockCreateWebhookEvent(...args),
    updateWebhookEventStatus: (...args: unknown[]) =>
      mockUpdateWebhookEventStatus(...args),
    scheduleWebhookEventRetry: (...args: unknown[]) =>
      mockScheduleWebhookEventRetry(...args),
  },
}));

import { WebhookDispatcherService } from "../webhook-dispatcher.service";
import type { PosWebhookProvider } from "../pos-webhook-provider.interface";

const TENANT_ID = "tenant-1";
const MERCHANT_ID = "merchant-1";
const CONNECTION_ID = "conn-1";

function createMockProvider(
  overrides: Partial<PosWebhookProvider> = {}
): PosWebhookProvider {
  return {
    type: "POS_TEST",
    verifyWebhook: vi.fn().mockReturnValue(true),
    parseWebhookEvent: vi.fn().mockReturnValue({
      eventId: "evt-1",
      eventType: "test.event",
      externalAccountId: "ext-acct-1",
      rawPayload: { some: "data" },
    }),
    handleWebhookEvent: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("WebhookDispatcherService", () => {
  let dispatcher: WebhookDispatcherService;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatcher = new WebhookDispatcherService();

    mockFindWebhookEventByEventId.mockResolvedValue(null);
    mockGetConnectionByExternalAccountId.mockResolvedValue({
      id: CONNECTION_ID,
      tenantId: TENANT_ID,
      merchantId: MERCHANT_ID,
    });
    mockCreateWebhookEvent.mockResolvedValue({ id: "we-1", eventId: "evt-1" });
    mockUpdateWebhookEventStatus.mockResolvedValue({});
    mockScheduleWebhookEventRetry.mockResolvedValue({});
  });

  // ==================== Registration ====================

  describe("register / hasProvider", () => {
    it("should register and find a provider", () => {
      const provider = createMockProvider();
      dispatcher.register("test", provider);

      expect(dispatcher.hasProvider("test")).toBe(true);
      expect(dispatcher.hasProvider("unknown")).toBe(false);
    });
  });

  // ==================== Dispatch: provider lookup ====================

  describe("dispatch - provider lookup", () => {
    it("should return 400 for unknown provider", async () => {
      const result = await dispatcher.dispatch("unknown", "{}", {});

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("unknown_provider");
    });
  });

  // ==================== Dispatch: signature verification ====================

  describe("dispatch - signature verification", () => {
    it("should return 401 when verification fails", async () => {
      const provider = createMockProvider({
        verifyWebhook: vi.fn().mockReturnValue(false),
      });
      dispatcher.register("test", provider);

      const result = await dispatcher.dispatch("test", "{}", { sig: "bad" });

      expect(result.status).toBe(401);
      expect(result.body.error).toBe("invalid_signature");
    });
  });

  // ==================== Dispatch: connection lookup ====================

  describe("dispatch - connection lookup", () => {
    it("should return 200 with error when no connection found", async () => {
      const provider = createMockProvider();
      dispatcher.register("test", provider);
      mockGetConnectionByExternalAccountId.mockResolvedValue(null);

      const result = await dispatcher.dispatch("test", "{}", {});

      expect(result.status).toBe(200);
      expect(result.body.error).toBe("connection_not_found");
      expect(mockCreateWebhookEvent).not.toHaveBeenCalled();
    });

    it("should look up connection using provider type", async () => {
      const provider = createMockProvider({ type: "POS_SQUARE" });
      dispatcher.register("square", provider);

      await dispatcher.dispatch("square", "{}", {});

      expect(mockGetConnectionByExternalAccountId).toHaveBeenCalledWith(
        "ext-acct-1",
        "POS_SQUARE"
      );
    });
  });

  // ==================== Dispatch: dedup (scoped by connection) ====================

  describe("dispatch - dedup", () => {
    it("should return 200 with deduplicated flag for duplicate events", async () => {
      const provider = createMockProvider();
      dispatcher.register("test", provider);
      mockFindWebhookEventByEventId.mockResolvedValue({
        id: "we-existing",
        eventId: "evt-1",
      });

      const result = await dispatcher.dispatch("test", "{}", {});

      expect(result.status).toBe(200);
      expect(result.body.deduplicated).toBe(true);
      expect(mockCreateWebhookEvent).not.toHaveBeenCalled();
    });

    it("should scope dedup by connectionId", async () => {
      const provider = createMockProvider();
      dispatcher.register("test", provider);

      await dispatcher.dispatch("test", "{}", {});

      expect(mockFindWebhookEventByEventId).toHaveBeenCalledWith(
        CONNECTION_ID,
        "evt-1"
      );
    });
  });

  // ==================== Dispatch: happy path ====================

  describe("dispatch - success", () => {
    it("should create event, process, and mark as processed", async () => {
      const provider = createMockProvider();
      dispatcher.register("test", provider);

      const result = await dispatcher.dispatch("test", '{"raw":"body"}', {
        "x-sig": "valid",
      });

      expect(result.status).toBe(200);
      expect(result.body.received).toBe(true);

      // Event created
      expect(mockCreateWebhookEvent).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        merchantId: MERCHANT_ID,
        connectionId: CONNECTION_ID,
        eventId: "evt-1",
        eventType: "test.event",
        payload: { some: "data" },
      });

      // Provider handler called with correct args
      expect(provider.handleWebhookEvent).toHaveBeenCalledWith(
        {
          eventId: "evt-1",
          eventType: "test.event",
          externalAccountId: "ext-acct-1",
          rawPayload: { some: "data" },
        },
        {
          tenantId: TENANT_ID,
          merchantId: MERCHANT_ID,
          id: CONNECTION_ID,
        }
      );

      // Marked as processed
      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith(
        "we-1",
        "processed"
      );
    });
  });

  // ==================== Dispatch: handler failure ====================

  describe("dispatch - handler failure", () => {
    it("should schedule retry when handler throws", async () => {
      const provider = createMockProvider({
        handleWebhookEvent: vi.fn().mockRejectedValue(new Error("boom")),
      });
      dispatcher.register("test", provider);

      const result = await dispatcher.dispatch("test", "{}", {});

      expect(result.status).toBe(200);
      expect(result.body.received).toBe(true);

      expect(mockScheduleWebhookEventRetry).toHaveBeenCalledWith(
        "we-1",
        1,
        expect.any(Date),
        "boom"
      );
      expect(mockUpdateWebhookEventStatus).not.toHaveBeenCalled();
    });

    it("should use 'Unknown error' when handler throws a non-Error", async () => {
      const provider = createMockProvider({
        handleWebhookEvent: vi.fn().mockRejectedValue("string-error"),
      });
      dispatcher.register("test", provider);

      await dispatcher.dispatch("test", "{}", {});

      expect(mockScheduleWebhookEventRetry).toHaveBeenCalledWith(
        "we-1",
        1,
        expect.any(Date),
        "Unknown error"
      );
    });
  });

  // ==================== Dispatch: pipeline error ack ====================

  describe("dispatch - pipeline error", () => {
    it("should return 200 when parseWebhookEvent throws after valid signature", async () => {
      const provider = createMockProvider({
        parseWebhookEvent: vi.fn().mockImplementation(() => {
          throw new Error("malformed JSON");
        }),
      });
      dispatcher.register("test", provider);

      const result = await dispatcher.dispatch("test", "bad-json", {});

      expect(result.status).toBe(200);
      expect(result.body.received).toBe(true);
    });

    it("should return 200 when createWebhookEvent throws", async () => {
      const provider = createMockProvider();
      dispatcher.register("test", provider);
      mockCreateWebhookEvent.mockRejectedValue(new Error("DB error"));

      const result = await dispatcher.dispatch("test", "{}", {});

      expect(result.status).toBe(200);
      expect(result.body.received).toBe(true);
    });
  });

  // ==================== Dispatch: passes raw body and headers ====================

  describe("dispatch - passes inputs correctly", () => {
    it("should pass rawBody to verifyWebhook and parseWebhookEvent", async () => {
      const provider = createMockProvider();
      dispatcher.register("test", provider);
      const rawBody = '{"foo":"bar"}';
      const headers = { "x-sig": "abc" };

      await dispatcher.dispatch("test", rawBody, headers);

      expect(provider.verifyWebhook).toHaveBeenCalledWith(rawBody, headers);
      expect(provider.parseWebhookEvent).toHaveBeenCalledWith(rawBody);
    });
  });
});
