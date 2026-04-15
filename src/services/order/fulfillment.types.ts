import type { FulfillmentStatus } from "@/types";

// Import from canonical location and re-export for backward compatibility
import type { FulfillmentChangeSource } from "@/types";
export type { FulfillmentChangeSource } from "@/types";

/** Input for creating a fulfillment (typically during order creation) */
export interface CreateFulfillmentInput {
  orderId: string;
  merchantId: string;
  posProvider?: string;
  externalVersion?: number;
}

/** Input for transitioning fulfillment status */
export interface TransitionStatusInput {
  fulfillmentStatus: FulfillmentStatus;
  source: FulfillmentChangeSource;
  actorId?: string;
  metadata?: Record<string, unknown>;
  externalVersion?: number;
}

/** Status log entry returned to callers */
export interface StatusLogEntry {
  id: string;
  fromStatus: string;
  toStatus: string;
  source: string;
  actorId: string | null;
  metadata: unknown;
  createdAt: Date;
}
