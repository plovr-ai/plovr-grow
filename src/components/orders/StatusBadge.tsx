import type { OrderStatus, FulfillmentStatus } from "@/types";
import { cn } from "@/lib/utils";

// Payment status configuration
const paymentStatusConfig: Record<OrderStatus, { label: string; className: string }> = {
  created: {
    label: "Unpaid",
    className: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  partial_paid: {
    label: "Partial Paid",
    className: "bg-orange-100 text-orange-800 border-orange-300",
  },
  completed: {
    label: "Paid",
    className: "bg-green-100 text-green-800 border-green-300",
  },
  canceled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-800 border-red-300",
  },
};

// Fulfillment status configuration
const fulfillmentStatusConfig: Record<FulfillmentStatus, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-gray-100 text-gray-800 border-gray-300",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-blue-100 text-blue-800 border-blue-300",
  },
  preparing: {
    label: "Preparing",
    className: "bg-purple-100 text-purple-800 border-purple-300",
  },
  ready: {
    label: "Ready",
    className: "bg-green-100 text-green-800 border-green-300",
  },
  fulfilled: {
    label: "Fulfilled",
    className: "bg-gray-100 text-gray-600 border-gray-300",
  },
};

interface PaymentStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const config = paymentStatusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

interface FulfillmentStatusBadgeProps {
  status: FulfillmentStatus;
  className?: string;
}

export function FulfillmentStatusBadge({ status, className }: FulfillmentStatusBadgeProps) {
  const config = fulfillmentStatusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

// Legacy StatusBadge for backward compatibility during migration
interface StatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * @deprecated Use PaymentStatusBadge or FulfillmentStatusBadge instead
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  // Check if it's a payment status
  if (status in paymentStatusConfig) {
    return <PaymentStatusBadge status={status as OrderStatus} className={className} />;
  }

  // Check if it's a fulfillment status
  if (status in fulfillmentStatusConfig) {
    return <FulfillmentStatusBadge status={status as FulfillmentStatus} className={className} />;
  }

  // Fallback for unknown status
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        "bg-gray-100 text-gray-800 border-gray-300",
        className
      )}
    >
      {status}
    </span>
  );
}
