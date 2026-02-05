"use client";

import type { SubscriptionStatus } from "@/services/subscription/subscription.types";

interface SubscriptionStatusBadgeProps {
  status: SubscriptionStatus;
}

const statusConfig: Record<SubscriptionStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-green-100 text-green-800",
  },
  trialing: {
    label: "Trial",
    className: "bg-blue-100 text-blue-800",
  },
  past_due: {
    label: "Past Due",
    className: "bg-red-100 text-red-800",
  },
  canceled: {
    label: "Canceled",
    className: "bg-gray-100 text-gray-800",
  },
  incomplete: {
    label: "Incomplete",
    className: "bg-yellow-100 text-yellow-800",
  },
  unpaid: {
    label: "Unpaid",
    className: "bg-red-100 text-red-800",
  },
  paused: {
    label: "Paused",
    className: "bg-gray-100 text-gray-600",
  },
};

export function SubscriptionStatusBadge({ status }: SubscriptionStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.incomplete;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
