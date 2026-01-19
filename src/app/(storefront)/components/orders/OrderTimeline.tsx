"use client";

import type { OrderStatus } from "@/types";
import type { TimelineEvent } from "./order-detail.types";

interface Props {
  timeline: TimelineEvent[];
  cancelReason?: string | null;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending: {
    label: "Order Placed",
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
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
  ready: {
    label: "Ready",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  completed: {
    label: "Completed",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
};

function formatTimestamp(timestamp: Date | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(timestamp: Date | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function OrderTimeline({ timeline, cancelReason }: Props) {
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
          const config = STATUS_CONFIG[event.status];
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
                  {formatDate(event.timestamp)} at {formatTimestamp(event.timestamp)}
                </p>
                {event.status === "cancelled" && cancelReason && (
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
