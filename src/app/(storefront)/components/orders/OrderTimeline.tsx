"use client";

import type { OrderStatus, FulfillmentStatus } from "@/types";
import type { TimelineEvent } from "./order-detail.types";
import { useFormatDateTime } from "@/hooks";

interface Props {
  timeline: TimelineEvent[];
  cancelReason?: string | null;
}

// Combined status config for both payment and fulfillment statuses
const STATUS_CONFIG: Record<
  OrderStatus | FulfillmentStatus,
  { label: string; color: string; bgColor: string }
> = {
  // Payment statuses
  created: {
    label: "Order Placed",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
  },
  partial_paid: {
    label: "Partial Payment",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
  completed: {
    label: "Payment Completed",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  payment_failed: {
    label: "Payment Failed",
    color: "text-rose-600",
    bgColor: "bg-rose-100",
  },
  canceled: {
    label: "Cancelled",
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
  // Fulfillment statuses
  pending: {
    label: "Awaiting Fulfillment",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
  },
  confirmed: {
    label: "Order Confirmed",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  preparing: {
    label: "Preparing",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  ready: {
    label: "Ready",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  fulfilled: {
    label: "Fulfilled",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
};

export function OrderTimeline({ timeline, cancelReason }: Props) {
  const { formatDate, formatTime } = useFormatDateTime();
  // Sort timeline by timestamp descending (most recent first)
  const sortedTimeline = [...timeline].sort((a, b) => {
    const dateA = typeof a.timestamp === "string" ? new Date(a.timestamp) : a.timestamp;
    const dateB = typeof b.timestamp === "string" ? new Date(b.timestamp) : b.timestamp;
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Order Timeline</h2>
      <div className="relative">
        {sortedTimeline.map((event, index) => {
          const config = STATUS_CONFIG[event.status] || {
            label: event.status,
            color: "text-gray-600",
            bgColor: "bg-gray-100",
          };
          const isLast = index === sortedTimeline.length - 1;

          return (
            <div key={`${event.status}-${index}`} className="flex gap-3 pb-4 last:pb-0">
              {/* Timeline dot and line */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full ${config.bgColor} ring-4 ring-white`}
                />
                {!isLast && (
                  <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
                )}
              </div>

              {/* Event content */}
              <div className="flex-1 min-w-0 -mt-0.5">
                <p className={`font-medium ${config.color}`}>{config.label}</p>
                <p className="text-sm text-gray-400">
                  {formatDate(event.timestamp)} at {formatTime(event.timestamp)}
                </p>
                {event.status === "canceled" && cancelReason && (
                  <p className="text-sm text-red-500 mt-1">
                    Reason: {cancelReason}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
