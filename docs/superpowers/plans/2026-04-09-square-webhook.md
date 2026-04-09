# Square Webhook Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Square Webhook receiving, signature verification, event storage, and event routing (catalog re-sync, order status update, payment status update).

**Architecture:** A flat handler pattern matching the existing Stripe webhook. A new `SquareWebhookService` handles signature verification, event deduplication via `WebhookEvent` table, and routes events to handler methods. The route is `POST /api/integration/square/webhook`.

**Tech Stack:** Next.js App Router, Prisma, Node.js crypto (HMAC-SHA256), Vitest

---

## File Structure

```
新增:
  prisma/schema.prisma                                         — WebhookEvent model
  src/services/square/square-webhook.service.ts                — core webhook service
  src/services/square/__tests__/square-webhook.test.ts         — unit tests
  src/app/api/integration/square/webhook/route.ts              — API route
  src/app/api/integration/square/webhook/__tests__/route.test.ts — route tests

修改:
  src/services/square/square.config.ts                         — add webhook config
  src/services/square/square.types.ts                          — add webhook types + reverse fulfillment map
  src/repositories/integration.repository.ts                   — add webhook event CRUD + getConnectionByExternalAccountId
  src/lib/errors/error-codes.ts                                — add webhook error codes
  .env.example                                                 — add webhook env vars
```

---

### Task 1: Database Schema — WebhookEvent Model

**Files:**
- Modify: `prisma/schema.prisma:992+` (after IntegrationSyncRecord model)
- Modify: `.env.example:39+`

- [ ] **Step 1: Add WebhookEvent model to Prisma schema**

Open `prisma/schema.prisma` and add after the `IntegrationSyncRecord` model (line ~992):

```prisma
model WebhookEvent {
  id           String    @id
  tenantId     String    @map("tenant_id")
  merchantId   String    @map("merchant_id")
  connectionId String    @map("connection_id")
  eventId      String    @map("event_id")
  eventType    String    @map("event_type")
  payload      Json
  status       String    @default("received")
  errorMessage String?   @map("error_message") @db.Text
  processedAt  DateTime? @map("processed_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  tenant     Tenant                @relation(fields: [tenantId], references: [id])
  merchant   Merchant              @relation(fields: [merchantId], references: [id])
  connection IntegrationConnection @relation(fields: [connectionId], references: [id])

  @@unique([eventId])
  @@index([tenantId, merchantId, eventType])
  @@index([connectionId])
  @@index([status])
  @@map("webhook_events")
}
```

Also add the reverse relation to `IntegrationConnection` model (after `syncRecords` line ~943):

```prisma
  webhookEvents WebhookEvent[]
```

And add `WebhookEvent[]` relations to `Tenant` and `Merchant` models where their other relations are listed.

- [ ] **Step 2: Add webhook env vars to .env.example**

Append to `.env.example` after the existing Square section:

```
SQUARE_WEBHOOK_SIGNATURE_KEY=
SQUARE_WEBHOOK_NOTIFICATION_URL=
```

- [ ] **Step 3: Generate Prisma client**

Run: `npm run db:generate`
Expected: Prisma client regenerated successfully

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma .env.example
git commit -m "feat(square): add WebhookEvent model and webhook env vars (#44)"
```

---

### Task 2: Configuration and Types

**Files:**
- Modify: `src/services/square/square.config.ts`
- Modify: `src/services/square/square.types.ts`
- Modify: `src/lib/errors/error-codes.ts`

- [ ] **Step 1: Extend square.config.ts with webhook config**

Add webhook getters and `assertWebhookConfigured()` to `src/services/square/square.config.ts`:

```typescript
// Add inside the squareConfig object, after oauthBaseUrl getter:

  get webhookSignatureKey() {
    return process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";
  },
  get webhookNotificationUrl() {
    return process.env.SQUARE_WEBHOOK_NOTIFICATION_URL ?? "";
  },

  assertWebhookConfigured() {
    if (!this.enabled || !this.webhookSignatureKey || !this.webhookNotificationUrl) {
      throw new AppError(ErrorCodes.SQUARE_WEBHOOK_NOT_CONFIGURED, undefined, 500);
    }
  },
```

- [ ] **Step 2: Add webhook types and reverse fulfillment map to square.types.ts**

Append to `src/services/square/square.types.ts`:

```typescript
// ==================== Webhook Types ====================

/**
 * Square webhook event payload (raw from Square API).
 */
export interface SquareWebhookPayload {
  merchant_id: string;
  type: string;
  event_id: string;
  created_at: string;
  data: {
    type: string;
    id: string;
    object?: Record<string, unknown>;
  };
}

/**
 * Webhook event status values.
 */
export const WEBHOOK_EVENT_STATUS = {
  RECEIVED: "received",
  PROCESSING: "processing",
  PROCESSED: "processed",
  FAILED: "failed",
} as const;

/**
 * Reverse fulfillment status mapping: Square FulfillmentState → internal status.
 * Used when receiving order updates from Square via webhook.
 */
export const REVERSE_FULFILLMENT_STATUS_MAP: Record<string, string> = {
  PROPOSED: "pending",
  RESERVED: "preparing",
  PREPARED: "ready",
  COMPLETED: "fulfilled",
} as const;

/**
 * Square webhook sync type for sync records.
 */
export const SQUARE_WEBHOOK_SYNC_TYPE = "WEBHOOK_EVENT" as const;
```

- [ ] **Step 3: Add webhook error codes**

Add to `src/lib/errors/error-codes.ts` in the Integration errors section (after `SQUARE_MISSING_LOCATION`):

```typescript
  SQUARE_WEBHOOK_NOT_CONFIGURED: "SQUARE_WEBHOOK_NOT_CONFIGURED",
  SQUARE_WEBHOOK_SIGNATURE_INVALID: "SQUARE_WEBHOOK_SIGNATURE_INVALID",
  SQUARE_WEBHOOK_PROCESSING_FAILED: "SQUARE_WEBHOOK_PROCESSING_FAILED",
```

- [ ] **Step 4: Commit**

```bash
git add src/services/square/square.config.ts src/services/square/square.types.ts src/lib/errors/error-codes.ts
git commit -m "feat(square): add webhook config, types, and error codes (#44)"
```

---

### Task 3: Integration Repository — Webhook Event CRUD

**Files:**
- Modify: `src/repositories/integration.repository.ts`

- [ ] **Step 1: Add webhook event methods to IntegrationRepository**

Add imports at the top of `src/repositories/integration.repository.ts`:

```typescript
import { generateEntityId } from "@/lib/id";
```

(Already imported — verify.)

Add these methods to the `IntegrationRepository` class:

```typescript
  // ==================== Webhook Events ====================

  async getConnectionByExternalAccountId(
    externalAccountId: string,
    type: string
  ) {
    return prisma.integrationConnection.findFirst({
      where: {
        externalAccountId,
        type,
        deleted: false,
        status: "active",
      },
    });
  }

  async findWebhookEventByEventId(eventId: string) {
    return prisma.webhookEvent.findUnique({
      where: { eventId },
    });
  }

  async createWebhookEvent(data: {
    tenantId: string;
    merchantId: string;
    connectionId: string;
    eventId: string;
    eventType: string;
    payload: unknown;
  }) {
    return prisma.webhookEvent.create({
      data: {
        id: generateEntityId(),
        tenantId: data.tenantId,
        merchantId: data.merchantId,
        connectionId: data.connectionId,
        eventId: data.eventId,
        eventType: data.eventType,
        payload: data.payload as never,
        status: "received",
      },
    });
  }

  async updateWebhookEventStatus(
    id: string,
    status: string,
    errorMessage?: string
  ) {
    return prisma.webhookEvent.update({
      where: { id },
      data: {
        status,
        errorMessage,
        processedAt: status === "processed" || status === "failed" ? new Date() : undefined,
      },
    });
  }
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to integration.repository.ts

- [ ] **Step 3: Commit**

```bash
git add src/repositories/integration.repository.ts
git commit -m "feat(square): add webhook event CRUD and connection lookup (#44)"
```

---

### Task 4: SquareWebhookService — Core Logic

**Files:**
- Create: `src/services/square/square-webhook.service.ts`
- Test: `src/services/square/__tests__/square-webhook.test.ts`

- [ ] **Step 1: Write failing tests for signature verification**

Create `src/services/square/__tests__/square-webhook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { SquareWebhookService } from "../square-webhook.service";

// Mock config
vi.mock("../square.config", () => ({
  squareConfig: {
    enabled: true,
    webhookSignatureKey: "test-webhook-secret",
    webhookNotificationUrl: "https://example.com/api/integration/square/webhook",
    assertWebhookConfigured: vi.fn(),
  },
}));

// Mock integration repository
const mockFindWebhookEventByEventId = vi.fn();
const mockCreateWebhookEvent = vi.fn();
const mockUpdateWebhookEventStatus = vi.fn();
const mockGetConnectionByExternalAccountId = vi.fn();
const mockGetConnection = vi.fn();

vi.mock("@/repositories/integration.repository", () => ({
  integrationRepository: {
    findWebhookEventByEventId: (...args: unknown[]) => mockFindWebhookEventByEventId(...args),
    createWebhookEvent: (...args: unknown[]) => mockCreateWebhookEvent(...args),
    updateWebhookEventStatus: (...args: unknown[]) => mockUpdateWebhookEventStatus(...args),
    getConnectionByExternalAccountId: (...args: unknown[]) => mockGetConnectionByExternalAccountId(...args),
    getConnection: (...args: unknown[]) => mockGetConnection(...args),
    getRunningSync: vi.fn().mockResolvedValue(null),
    createSyncRecord: vi.fn().mockResolvedValue({ id: "sync-1" }),
    updateSyncRecord: vi.fn(),
    getIdMappingByExternalId: vi.fn(),
  },
}));

// Mock Square service (for catalog sync)
vi.mock("../square.service", () => ({
  squareService: {
    syncCatalog: vi.fn().mockResolvedValue({ objectsSynced: 5, objectsMapped: 5 }),
  },
}));

// Mock order repository
const mockOrderUpdate = vi.fn();
vi.mock("@/lib/db", () => ({
  default: {
    order: {
      findFirst: vi.fn(),
      update: (...args: unknown[]) => mockOrderUpdate(...args),
    },
  },
}));

const WEBHOOK_SECRET = "test-webhook-secret";
const NOTIFICATION_URL = "https://example.com/api/integration/square/webhook";

function generateSignature(body: string): string {
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(NOTIFICATION_URL + body);
  return hmac.digest("base64");
}

const samplePayload = {
  merchant_id: "sq-merchant-1",
  type: "catalog.version.updated",
  event_id: "evt-001",
  created_at: "2026-04-09T12:00:00Z",
  data: {
    type: "catalog",
    id: "catalog-1",
  },
};

const mockConnection = {
  id: "conn-1",
  tenantId: "tenant-1",
  merchantId: "merchant-1",
  type: "POS_SQUARE",
  externalAccountId: "sq-merchant-1",
  externalLocationId: "sq-loc-1",
  accessToken: "access-token-123",
  status: "active",
};

describe("SquareWebhookService", () => {
  let service: SquareWebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SquareWebhookService();

    // Default mocks
    mockGetConnectionByExternalAccountId.mockResolvedValue(mockConnection);
    mockFindWebhookEventByEventId.mockResolvedValue(null);
    mockCreateWebhookEvent.mockResolvedValue({ id: "wh-1", eventId: "evt-001" });
    mockUpdateWebhookEventStatus.mockResolvedValue(undefined);
  });

  // ==================== Signature Verification ====================

  describe("verifySignature", () => {
    it("should return true for a valid signature", () => {
      const body = JSON.stringify(samplePayload);
      const signature = generateSignature(body);
      expect(service.verifySignature(body, signature)).toBe(true);
    });

    it("should return false for an invalid signature", () => {
      const body = JSON.stringify(samplePayload);
      expect(service.verifySignature(body, "invalid-base64-signature")).toBe(false);
    });

    it("should return false for a tampered body", () => {
      const body = JSON.stringify(samplePayload);
      const signature = generateSignature(body);
      const tamperedBody = body.replace("evt-001", "evt-999");
      expect(service.verifySignature(tamperedBody, signature)).toBe(false);
    });

    it("should return false for empty signature", () => {
      const body = JSON.stringify(samplePayload);
      expect(service.verifySignature(body, "")).toBe(false);
    });
  });

  // ==================== Event Deduplication ====================

  describe("handleWebhook", () => {
    it("should skip duplicate events", async () => {
      mockFindWebhookEventByEventId.mockResolvedValue({ id: "existing-1" });

      const body = JSON.stringify(samplePayload);
      const result = await service.handleWebhook(body);

      expect(result).toEqual({ deduplicated: true });
      expect(mockCreateWebhookEvent).not.toHaveBeenCalled();
    });

    it("should store event and process it", async () => {
      const body = JSON.stringify(samplePayload);
      const result = await service.handleWebhook(body);

      expect(mockCreateWebhookEvent).toHaveBeenCalledWith({
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        connectionId: "conn-1",
        eventId: "evt-001",
        eventType: "catalog.version.updated",
        payload: samplePayload,
      });
      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith("wh-1", "processed", undefined);
      expect(result).toEqual({ deduplicated: false });
    });

    it("should set status to failed when connection not found", async () => {
      mockGetConnectionByExternalAccountId.mockResolvedValue(null);

      const body = JSON.stringify(samplePayload);
      const result = await service.handleWebhook(body);

      expect(result).toEqual({ error: "connection_not_found" });
    });

    it("should set status to failed when handler throws", async () => {
      // Use an order.updated event that will trigger handleOrderUpdate
      const orderPayload = {
        ...samplePayload,
        type: "order.updated",
        event_id: "evt-002",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              fulfillments: [{ state: "RESERVED" }],
            },
          },
        },
      };

      // Mock the ID mapping lookup to throw
      const { integrationRepository } = await import("@/repositories/integration.repository");
      vi.mocked(integrationRepository.getIdMappingByExternalId).mockRejectedValue(
        new Error("DB connection failed")
      );

      mockCreateWebhookEvent.mockResolvedValue({ id: "wh-2", eventId: "evt-002" });

      const body = JSON.stringify(orderPayload);
      await service.handleWebhook(body);

      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith(
        "wh-2",
        "failed",
        "DB connection failed"
      );
    });

    it("should process unhandled event types as processed (store only)", async () => {
      const unknownPayload = {
        ...samplePayload,
        type: "inventory.count.updated",
        event_id: "evt-003",
      };

      mockCreateWebhookEvent.mockResolvedValue({ id: "wh-3", eventId: "evt-003" });

      const body = JSON.stringify(unknownPayload);
      await service.handleWebhook(body);

      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith("wh-3", "processed", undefined);
    });
  });

  // ==================== Catalog Change Handler ====================

  describe("handleCatalogChange", () => {
    it("should trigger catalog re-sync via squareService", async () => {
      const { squareService } = await import("../square.service");

      // Need to get companyId from merchant
      const prisma = (await import("@/lib/db")).default;

      const body = JSON.stringify(samplePayload);
      await service.handleWebhook(body);

      // The handler should call squareService.syncCatalog
      expect(squareService.syncCatalog).toHaveBeenCalledWith(
        "tenant-1",
        "merchant-1",
        expect.any(String)
      );
    });
  });

  // ==================== Order Update Handler ====================

  describe("handleOrderUpdate", () => {
    it("should update internal order fulfillment status", async () => {
      const orderPayload = {
        ...samplePayload,
        type: "order.updated",
        event_id: "evt-010",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              fulfillments: [{ state: "PREPARED" }],
            },
          },
        },
      };

      const { integrationRepository } = await import("@/repositories/integration.repository");
      vi.mocked(integrationRepository.getIdMappingByExternalId).mockResolvedValue({
        id: "mapping-1",
        tenantId: "tenant-1",
        internalType: "Order",
        internalId: "order-internal-1",
        externalSource: "SQUARE",
        externalType: "ORDER",
        externalId: "sq-order-1",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockCreateWebhookEvent.mockResolvedValue({ id: "wh-10", eventId: "evt-010" });

      const body = JSON.stringify(orderPayload);
      await service.handleWebhook(body);

      expect(mockOrderUpdate).toHaveBeenCalledWith({
        where: { id: "order-internal-1" },
        data: {
          fulfillmentStatus: "ready",
          readyAt: expect.any(Date),
        },
      });
    });

    it("should skip when no ID mapping found for Square order", async () => {
      const orderPayload = {
        ...samplePayload,
        type: "order.updated",
        event_id: "evt-011",
        data: {
          type: "order",
          id: "sq-order-unknown",
          object: {
            order: {
              id: "sq-order-unknown",
              fulfillments: [{ state: "RESERVED" }],
            },
          },
        },
      };

      const { integrationRepository } = await import("@/repositories/integration.repository");
      vi.mocked(integrationRepository.getIdMappingByExternalId).mockResolvedValue(null);

      mockCreateWebhookEvent.mockResolvedValue({ id: "wh-11", eventId: "evt-011" });

      const body = JSON.stringify(orderPayload);
      await service.handleWebhook(body);

      expect(mockOrderUpdate).not.toHaveBeenCalled();
      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith("wh-11", "processed", undefined);
    });
  });

  // ==================== Payment Event Handler ====================

  describe("handlePaymentEvent", () => {
    it("should update order payment status for payment.completed", async () => {
      const paymentPayload = {
        ...samplePayload,
        type: "payment.completed",
        event_id: "evt-020",
        data: {
          type: "payment",
          id: "sq-payment-1",
          object: {
            payment: {
              id: "sq-payment-1",
              order_id: "sq-order-1",
              status: "COMPLETED",
            },
          },
        },
      };

      const { integrationRepository } = await import("@/repositories/integration.repository");
      vi.mocked(integrationRepository.getIdMappingByExternalId).mockResolvedValue({
        id: "mapping-2",
        tenantId: "tenant-1",
        internalType: "Order",
        internalId: "order-internal-2",
        externalSource: "SQUARE",
        externalType: "ORDER",
        externalId: "sq-order-1",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockCreateWebhookEvent.mockResolvedValue({ id: "wh-20", eventId: "evt-020" });

      const body = JSON.stringify(paymentPayload);
      await service.handleWebhook(body);

      expect(mockOrderUpdate).toHaveBeenCalledWith({
        where: { id: "order-internal-2" },
        data: {
          status: "completed",
          paidAt: expect.any(Date),
        },
      });
    });

    it("should skip payment event when no order mapping found", async () => {
      const paymentPayload = {
        ...samplePayload,
        type: "payment.completed",
        event_id: "evt-021",
        data: {
          type: "payment",
          id: "sq-payment-2",
          object: {
            payment: {
              id: "sq-payment-2",
              order_id: "sq-order-unknown",
              status: "COMPLETED",
            },
          },
        },
      };

      const { integrationRepository } = await import("@/repositories/integration.repository");
      vi.mocked(integrationRepository.getIdMappingByExternalId).mockResolvedValue(null);

      mockCreateWebhookEvent.mockResolvedValue({ id: "wh-21", eventId: "evt-021" });

      const body = JSON.stringify(paymentPayload);
      await service.handleWebhook(body);

      expect(mockOrderUpdate).not.toHaveBeenCalled();
      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith("wh-21", "processed", undefined);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern="square-webhook" --run 2>&1 | tail -30`
Expected: FAIL — module `../square-webhook.service` not found

- [ ] **Step 3: Implement SquareWebhookService**

Create `src/services/square/square-webhook.service.ts`:

```typescript
import crypto from "crypto";
import { squareConfig } from "./square.config";
import { integrationRepository } from "@/repositories/integration.repository";
import { squareService } from "./square.service";
import prisma from "@/lib/db";
import type { SquareWebhookPayload } from "./square.types";
import { REVERSE_FULFILLMENT_STATUS_MAP, WEBHOOK_EVENT_STATUS } from "./square.types";

const INTEGRATION_TYPE = "POS_SQUARE";

/**
 * Timestamp field mapping for each fulfillment status.
 */
const FULFILLMENT_TIMESTAMP_FIELD: Record<string, string> = {
  confirmed: "confirmedAt",
  preparing: "preparingAt",
  ready: "readyAt",
  fulfilled: "fulfilledAt",
};

/**
 * Service for receiving and processing Square webhook events.
 *
 * Handles:
 * - HMAC-SHA256 signature verification
 * - Event deduplication by eventId
 * - Event routing to appropriate handlers
 * - Raw event storage for audit
 */
export class SquareWebhookService {
  /**
   * Verify the webhook signature using HMAC-SHA256.
   * Square signs: HMAC-SHA256(webhookSignatureKey, notificationUrl + rawBody)
   */
  verifySignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;

    try {
      const hmac = crypto.createHmac("sha256", squareConfig.webhookSignatureKey);
      hmac.update(squareConfig.webhookNotificationUrl + rawBody);
      const expected = hmac.digest("base64");

      // Timing-safe comparison
      const sigBuffer = Buffer.from(signature, "base64");
      const expectedBuffer = Buffer.from(expected, "base64");

      if (sigBuffer.length !== expectedBuffer.length) return false;
      return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Main entry point: parse, deduplicate, store, and route the webhook event.
   */
  async handleWebhook(
    rawBody: string
  ): Promise<{ deduplicated?: boolean; error?: string }> {
    const payload: SquareWebhookPayload = JSON.parse(rawBody);
    const { merchant_id, type: eventType, event_id: eventId } = payload;

    // Deduplication check
    const existing = await integrationRepository.findWebhookEventByEventId(eventId);
    if (existing) {
      console.log(`[Square Webhook] Duplicate event skipped: ${eventId}`);
      return { deduplicated: true };
    }

    // Look up connection by Square merchant ID
    const connection = await integrationRepository.getConnectionByExternalAccountId(
      merchant_id,
      INTEGRATION_TYPE
    );

    if (!connection) {
      console.error(`[Square Webhook] No connection found for Square merchant: ${merchant_id}`);
      return { error: "connection_not_found" };
    }

    // Store event
    const webhookEvent = await integrationRepository.createWebhookEvent({
      tenantId: connection.tenantId,
      merchantId: connection.merchantId,
      connectionId: connection.id,
      eventId,
      eventType,
      payload,
    });

    // Route to handler
    try {
      await this.routeEvent(eventType, payload, connection);
      await integrationRepository.updateWebhookEventStatus(
        webhookEvent.id,
        WEBHOOK_EVENT_STATUS.PROCESSED
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Square Webhook] Handler failed for ${eventType}:`, errorMessage);
      await integrationRepository.updateWebhookEventStatus(
        webhookEvent.id,
        WEBHOOK_EVENT_STATUS.FAILED,
        errorMessage
      );
    }

    return { deduplicated: false };
  }

  /**
   * Route event to the appropriate handler.
   */
  private async routeEvent(
    eventType: string,
    payload: SquareWebhookPayload,
    connection: { tenantId: string; merchantId: string; id: string }
  ): Promise<void> {
    switch (eventType) {
      case "catalog.version.updated":
        await this.handleCatalogChange(connection);
        break;
      case "order.updated":
        await this.handleOrderUpdate(payload, connection.tenantId);
        break;
      case "payment.completed":
      case "payment.updated":
        await this.handlePaymentEvent(payload, connection.tenantId);
        break;
      default:
        // Unhandled event type — stored but not processed
        console.log(`[Square Webhook] Unhandled event type: ${eventType}`);
    }
  }

  /**
   * Handle catalog.version.updated: trigger full catalog re-sync.
   */
  private async handleCatalogChange(
    connection: { tenantId: string; merchantId: string }
  ): Promise<void> {
    // Look up companyId from merchant
    const merchant = await prisma.merchant.findFirst({
      where: { id: connection.merchantId },
      select: { companyId: true },
    });

    if (!merchant) {
      console.error(`[Square Webhook] Merchant not found: ${connection.merchantId}`);
      return;
    }

    console.log(`[Square Webhook] Triggering catalog re-sync for merchant: ${connection.merchantId}`);

    try {
      await squareService.syncCatalog(
        connection.tenantId,
        connection.merchantId,
        merchant.companyId
      );
    } catch (error) {
      // If sync is already running, that's fine — the concurrency guard handled it
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("ALREADY_RUNNING")) {
        throw error;
      }
      console.log("[Square Webhook] Catalog sync already running, skipped");
    }
  }

  /**
   * Handle order.updated: update internal order fulfillment status.
   */
  private async handleOrderUpdate(
    payload: SquareWebhookPayload,
    tenantId: string
  ): Promise<void> {
    const squareOrderId = payload.data.id;
    const orderObj = (payload.data.object as Record<string, unknown>)?.order as
      | { id: string; fulfillments?: Array<{ state: string }> }
      | undefined;

    const squareFulfillmentState = orderObj?.fulfillments?.[0]?.state;
    if (!squareFulfillmentState) {
      console.log("[Square Webhook] No fulfillment state in order update, skipping");
      return;
    }

    // Map Square state to internal status
    const internalStatus = REVERSE_FULFILLMENT_STATUS_MAP[squareFulfillmentState];
    if (!internalStatus) {
      console.log(`[Square Webhook] Unknown Square fulfillment state: ${squareFulfillmentState}`);
      return;
    }

    // Reverse lookup: Square order ID → internal order ID
    const mapping = await integrationRepository.getIdMappingByExternalId(
      tenantId,
      "SQUARE",
      squareOrderId
    );

    if (!mapping) {
      console.log(`[Square Webhook] No mapping for Square order: ${squareOrderId}, skipping`);
      return;
    }

    // Build update data with timestamp
    const timestampField = FULFILLMENT_TIMESTAMP_FIELD[internalStatus];
    const updateData: Record<string, unknown> = {
      fulfillmentStatus: internalStatus,
    };
    if (timestampField) {
      updateData[timestampField] = new Date();
    }

    await prisma.order.update({
      where: { id: mapping.internalId },
      data: updateData,
    });

    console.log(`[Square Webhook] Order ${mapping.internalId} fulfillment updated to: ${internalStatus}`);
  }

  /**
   * Handle payment.completed / payment.updated: update order payment status.
   */
  private async handlePaymentEvent(
    payload: SquareWebhookPayload,
    tenantId: string
  ): Promise<void> {
    const paymentObj = (payload.data.object as Record<string, unknown>)?.payment as
      | { id: string; order_id?: string; status?: string }
      | undefined;

    const squareOrderId = paymentObj?.order_id;
    if (!squareOrderId) {
      console.log("[Square Webhook] No order_id in payment event, skipping");
      return;
    }

    // Reverse lookup: Square order ID → internal order ID
    const mapping = await integrationRepository.getIdMappingByExternalId(
      tenantId,
      "SQUARE",
      squareOrderId
    );

    if (!mapping) {
      console.log(`[Square Webhook] No mapping for Square order: ${squareOrderId}, skipping`);
      return;
    }

    const paymentStatus = paymentObj?.status;
    if (paymentStatus === "COMPLETED") {
      await prisma.order.update({
        where: { id: mapping.internalId },
        data: {
          status: "completed",
          paidAt: new Date(),
        },
      });
      console.log(`[Square Webhook] Order ${mapping.internalId} payment completed`);
    } else if (paymentStatus === "FAILED") {
      await prisma.order.update({
        where: { id: mapping.internalId },
        data: {
          status: "canceled",
          cancelledAt: new Date(),
          cancelReason: "Payment failed on Square",
        },
      });
      console.log(`[Square Webhook] Order ${mapping.internalId} payment failed`);
    }
  }
}

export const squareWebhookService = new SquareWebhookService();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern="square-webhook" --run 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/square/square-webhook.service.ts src/services/square/__tests__/square-webhook.test.ts
git commit -m "feat(square): implement SquareWebhookService with signature verification and event handlers (#44)"
```

---

### Task 5: API Route

**Files:**
- Create: `src/app/api/integration/square/webhook/route.ts`
- Test: `src/app/api/integration/square/webhook/__tests__/route.test.ts`

- [ ] **Step 1: Write failing tests for the webhook route**

Create `src/app/api/integration/square/webhook/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { POST } from "../route";
import { NextRequest } from "next/server";

const WEBHOOK_SECRET = "test-webhook-secret";
const NOTIFICATION_URL = "https://example.com/api/integration/square/webhook";

// Mock the webhook service
const mockVerifySignature = vi.fn();
const mockHandleWebhook = vi.fn();

vi.mock("@/services/square/square-webhook.service", () => ({
  squareWebhookService: {
    verifySignature: (...args: unknown[]) => mockVerifySignature(...args),
    handleWebhook: (...args: unknown[]) => mockHandleWebhook(...args),
  },
}));

vi.mock("@/services/square/square.config", () => ({
  squareConfig: {
    enabled: true,
    webhookSignatureKey: WEBHOOK_SECRET,
    webhookNotificationUrl: NOTIFICATION_URL,
    assertWebhookConfigured: vi.fn(),
  },
}));

function generateSignature(body: string): string {
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(NOTIFICATION_URL + body);
  return hmac.digest("base64");
}

function buildRequest(body: string, signature?: string): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/integration/square/webhook",
    {
      method: "POST",
      body,
      headers: {
        ...(signature && { "x-square-hmacsha256-signature": signature }),
      },
    }
  );
}

describe("POST /api/integration/square/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 for missing signature", async () => {
    const body = JSON.stringify({ type: "test" });
    mockVerifySignature.mockReturnValue(false);

    const request = buildRequest(body);
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("should return 401 for invalid signature", async () => {
    const body = JSON.stringify({ type: "test" });
    mockVerifySignature.mockReturnValue(false);

    const request = buildRequest(body, "invalid-sig");
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("should return 200 and process valid webhook", async () => {
    const body = JSON.stringify({ type: "catalog.version.updated", event_id: "evt-1" });
    const signature = generateSignature(body);

    mockVerifySignature.mockReturnValue(true);
    mockHandleWebhook.mockResolvedValue({ deduplicated: false });

    const request = buildRequest(body, signature);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockHandleWebhook).toHaveBeenCalledWith(body);
  });

  it("should return 200 for duplicate events", async () => {
    const body = JSON.stringify({ type: "test", event_id: "dup-1" });
    const signature = generateSignature(body);

    mockVerifySignature.mockReturnValue(true);
    mockHandleWebhook.mockResolvedValue({ deduplicated: true });

    const request = buildRequest(body, signature);
    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it("should return 200 even when handler throws (prevent retry storm)", async () => {
    const body = JSON.stringify({ type: "test", event_id: "err-1" });
    const signature = generateSignature(body);

    mockVerifySignature.mockReturnValue(true);
    mockHandleWebhook.mockRejectedValue(new Error("handler failed"));

    const request = buildRequest(body, signature);
    const response = await POST(request);

    expect(response.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern="webhook/__tests__/route" --run 2>&1 | tail -20`
Expected: FAIL — module `../route` not found

- [ ] **Step 3: Implement the webhook route**

Create `src/app/api/integration/square/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { squareWebhookService } from "@/services/square/square-webhook.service";
import { squareConfig } from "@/services/square/square.config";

export async function POST(request: NextRequest) {
  // Read raw body for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") ?? "";

  // Verify signature
  if (!squareConfig.enabled || !squareWebhookService.verifySignature(rawBody, signature)) {
    console.error("[Square Webhook] Signature verification failed", {
      ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown",
      hasSignature: !!signature,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Process webhook (always return 200 to prevent retry storms)
  try {
    await squareWebhookService.handleWebhook(rawBody);
  } catch (error) {
    console.error("[Square Webhook] Unhandled error:", error);
  }

  return NextResponse.json({ received: true });
}

export const runtime = "nodejs";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern="webhook/__tests__/route" --run 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/integration/square/webhook/route.ts src/app/api/integration/square/webhook/__tests__/route.test.ts
git commit -m "feat(square): add webhook API route with signature verification (#44)"
```

---

### Task 6: Type Check, Lint, and Full Test Suite

**Files:** All modified files

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit --pretty 2>&1 | tail -30`
Expected: No errors

- [ ] **Step 2: Run linter**

Run: `npm run lint 2>&1 | tail -30`
Expected: No errors (or only pre-existing warnings)

- [ ] **Step 3: Run full test suite**

Run: `npm test -- --run 2>&1 | tail -40`
Expected: All tests pass, no regressions

- [ ] **Step 4: Fix any issues found**

If any type errors, lint violations, or test failures are found, fix them and re-run the failing check.

- [ ] **Step 5: Final commit (if fixes needed)**

```bash
git add -A
git commit -m "fix(square): resolve lint/type issues in webhook implementation (#44)"
```

---

### Task 7: Code Review and Cleanup

**Files:** All changed files

- [ ] **Step 1: Review all changes**

Run: `git diff origin/main --stat` to see all changed files.
Run: `git diff origin/main` to review the full diff.

Check against:
- No `any` types (use `unknown` or specific types)
- No `enum` usage (use `const` objects)
- No hardcoded error messages in service layer (use AppError + error codes)
- No `console.log` statements that should be removed (keep structured logging for webhook events)
- No unused imports
- Service methods follow `tenantId` first parameter convention
- `WebhookEvent` model has `tenantId` and `merchantId` fields

- [ ] **Step 2: Verify all tests pass one final time**

Run: `npm test -- --run 2>&1 | tail -20`
Expected: All tests pass
