"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, User, Phone, Mail, MapPin, FileText } from "lucide-react";
import { useDashboardFormatPrice, useDashboardFormatDateTime } from "@/hooks";
import { formatCustomerName } from "@/lib/names";
import { getApiErrorMessage } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { PaymentStatusBadge, FulfillmentStatusBadge } from "./StatusBadge";
import type { OrderStatus, FulfillmentStatus, OrderMode, OrderItemData, DeliveryAddress, SalesChannel, PaymentType } from "@/types";
import type { FeeBreakdownItem } from "@/lib/pricing";

// Types for Dashboard Order Detail
interface TimelineEvent {
  status: OrderStatus | FulfillmentStatus;
  timestamp: Date | string;
}

export interface DashboardOrderDetailData {
  id: string;
  orderNumber: string;
  status: string;
  fulfillmentStatus: string;
  orderMode: string;
  salesChannel: string;
  paymentType: string;
  items: OrderItemData[];
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: DeliveryAddress | null;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  deliveryFee: number;
  feesAmount: number;
  feesBreakdown: FeeBreakdownItem[];
  discount: number;
  totalAmount: number;
  createdAt: Date | string;
  paidAt: Date | string | null;
  cancelledAt: Date | string | null;
  cancelReason: string | null;
  timeline: TimelineEvent[];
  merchant: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
}

interface Props {
  order: DashboardOrderDetailData;
  imageMap: Record<string, string | null>;
}

const orderModeLabels: Record<OrderMode, string> = {
  pickup: "Pickup",
  delivery: "Delivery",
  dine_in: "Dine In",
};

const salesChannelLabels: Record<SalesChannel, string> = {
  online_order: "Online Order",
  catering: "Catering",
  giftcard: "Gift Card",
  phone_order: "Phone Order",
};

// ==================== Order Status Progress ====================
interface FulfillmentStep {
  status: FulfillmentStatus;
  label: string;
}

const FULFILLMENT_STEPS: FulfillmentStep[] = [
  { status: "pending", label: "Pending" },
  { status: "confirmed", label: "Confirmed" },
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready" },
  { status: "fulfilled", label: "Fulfilled" },
];

const FULFILLMENT_ORDER: Record<FulfillmentStatus, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  fulfilled: 4,
  canceled: -1,
};

function OrderStatusProgress({
  paymentStatus,
  fulfillmentStatus,
  orderMode,
  paymentType,
  merchantId,
  orderId,
}: {
  paymentStatus: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  orderMode: OrderMode;
  paymentType: PaymentType;
  merchantId: string;
  orderId: string;
}) {
  const t = useTranslations("orders");
  const router = useRouter();
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [markPaidError, setMarkPaidError] = useState<string | null>(null);

  const handleMarkAsPaid = async () => {
    if (!window.confirm(t("actions.markAsPaidConfirm"))) {
      return;
    }

    setIsMarkingPaid(true);
    setMarkPaidError(null);

    try {
      const response = await fetch(
        `/api/dashboard/${merchantId}/orders/${orderId}/mark-paid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(data.error, t("actions.markPaidFailed")));
      }

      router.refresh();
    } catch (err) {
      setMarkPaidError(err instanceof Error ? err.message : t("actions.markPaidError"));
    } finally {
      setIsMarkingPaid(false);
    }
  };
  const currentIndex = FULFILLMENT_ORDER[fulfillmentStatus];
  const isCancelled = paymentStatus === "canceled";
  const isPaid = paymentStatus === "completed";

  // Show cancelled state
  if (isCancelled) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-red-800">Order Cancelled</p>
              <p className="text-sm text-red-600">This order has been cancelled</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show payment pending state
  if (!isPaid) {
    const isInStoreAwaitingPayment =
      paymentStatus === "created" && paymentType === "in_store";

    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-yellow-800">
                {isInStoreAwaitingPayment
                  ? t("awaitingInStorePayment")
                  : paymentStatus === "partial_paid"
                    ? t("partialPaymentTitle")
                    : t("awaitingPayment")}
              </p>
              <p className="text-sm text-yellow-600">
                {paymentStatus === "partial_paid"
                  ? t("partialPaymentMsg")
                  : t("awaitingPaymentMsg")}
              </p>
              {markPaidError && (
                <p className="text-sm text-red-600 mt-1">{markPaidError}</p>
              )}
            </div>
            {isInStoreAwaitingPayment && (
              <button
                onClick={handleMarkAsPaid}
                disabled={isMarkingPaid}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isMarkingPaid ? "..." : t("actions.markAsPaid")}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show fulfillment progress for paid orders
  const readyLabel = orderMode === "delivery" ? "Out for Delivery" : "Ready for Pickup";
  const fulfilledLabel = orderMode === "delivery" ? "Delivered" : "Picked Up";
  const stepsWithLabels = FULFILLMENT_STEPS.map((step) => {
    if (step.status === "ready") return { ...step, label: readyLabel };
    if (step.status === "fulfilled") return { ...step, label: fulfilledLabel };
    return step;
  });

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          {stepsWithLabels.map((step, index) => {
            const stepIndex = FULFILLMENT_ORDER[step.status];
            const isCompleted = stepIndex < currentIndex;
            const isCurrent = stepIndex === currentIndex;

            return (
              <div key={step.status} className="flex-1 flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : isCurrent
                          ? "bg-blue-500 text-white ring-4 ring-blue-100"
                          : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    {isCompleted ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={`text-xs mt-1.5 text-center ${
                      isCurrent
                        ? "font-medium text-blue-600"
                        : isCompleted
                          ? "text-gray-600"
                          : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>

                {index < stepsWithLabels.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded ${
                      stepIndex < currentIndex ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Order Items List ====================
function OrderItemsList({
  items,
  formatPrice,
  imageMap,
}: {
  items: OrderItemData[];
  formatPrice: (price: number) => string;
  imageMap: Record<string, string | null>;
}) {
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-gray-700">
          Order Items ({itemCount} {itemCount === 1 ? "item" : "items"})
        </h3>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-gray-100">
          {items.map((item, index) => {
            const imageUrl = imageMap[item.menuItemId];
            return (
            <li key={`${item.menuItemId}-${index}`} className="py-3 first:pt-0 last:pb-0">
              <div className="flex gap-3">
                {/* Item Image */}
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={item.name}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}

                {/* Item Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">
                      {item.quantity}x
                    </span>
                    <span className="font-medium text-gray-900 truncate">
                      {item.name}
                    </span>
                  </div>
                  {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">
                      {item.selectedModifiers.map((mod) => mod.modifierName).join(", ")}
                    </p>
                  )}
                  {item.specialInstructions && (
                    <p className="text-sm text-gray-400 mt-0.5 italic truncate">
                      {item.specialInstructions}
                    </p>
                  )}
                </div>

                {/* Price */}
                <span className="text-sm font-medium text-gray-900 flex-shrink-0">
                  {formatPrice(item.totalPrice)}
                </span>
              </div>
            </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// ==================== Price Summary ====================
function OrderPriceSummary({
  subtotal,
  taxAmount,
  tipAmount,
  deliveryFee,
  feesAmount,
  feesBreakdown,
  discount,
  totalAmount,
  formatPrice,
}: {
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  deliveryFee: number;
  feesAmount: number;
  feesBreakdown: FeeBreakdownItem[];
  discount: number;
  totalAmount: number;
  formatPrice: (price: number) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-gray-700">Payment Summary</h3>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Tax</span>
          <span>{formatPrice(taxAmount)}</span>
        </div>
        {deliveryFee > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Delivery Fee</span>
            <span>{formatPrice(deliveryFee)}</span>
          </div>
        )}
        {feesAmount > 0 && feesBreakdown.map((fee) => (
          <div key={fee.id} className="flex justify-between text-gray-600">
            <span>{fee.id}</span>
            <span>{formatPrice(fee.amount)}</span>
          </div>
        ))}
        {tipAmount > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Tip</span>
            <span>{formatPrice(tipAmount)}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span>
            <span>-{formatPrice(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-semibold text-gray-900 pt-2 border-t border-gray-100">
          <span>Total</span>
          <span>{formatPrice(totalAmount)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Customer Info ====================
function formatPhoneNumber(phone: string): string {
  // Simple US phone formatting: (xxx) xxx-xxxx
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

function CustomerInfo({
  customerFirstName,
  customerLastName,
  customerPhone,
  customerEmail,
  orderMode,
  deliveryAddress,
  notes,
}: {
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string | null;
  orderMode: OrderMode;
  deliveryAddress: DeliveryAddress | null;
  notes: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-gray-700">Customer Information</h3>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contact Information */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-600">
            <User className="w-4 h-4 text-gray-400" />
            <span>{formatCustomerName(customerFirstName, customerLastName)}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Phone className="w-4 h-4 text-gray-400" />
            <span>{formatPhoneNumber(customerPhone)}</span>
          </div>
          {customerEmail && (
            <div className="flex items-center gap-2 text-gray-600">
              <Mail className="w-4 h-4 text-gray-400" />
              <span>{customerEmail}</span>
            </div>
          )}
        </div>

        {/* Delivery Address */}
        {orderMode === "delivery" && deliveryAddress && (
          <div className="pt-3 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Delivery Address</h4>
            <div className="flex items-start gap-2 text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p>
                  {deliveryAddress.street}
                  {deliveryAddress.apt && `, ${deliveryAddress.apt}`}
                </p>
                <p>
                  {deliveryAddress.city}, {deliveryAddress.state} {deliveryAddress.zipCode}
                </p>
                {deliveryAddress.instructions && (
                  <p className="text-gray-400 text-sm mt-1 italic">
                    {deliveryAddress.instructions}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Order Notes */}
        {notes && (
          <div className="pt-3 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Order Notes</h4>
            <div className="flex items-start gap-2 text-gray-600">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
              <p className="italic">{notes}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== Order Timeline ====================
// Combined status config for both payment and fulfillment statuses
const TIMELINE_STATUS_CONFIG: Record<
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

function OrderTimeline({
  timeline,
  cancelReason,
  formatDate,
  formatTime,
}: {
  timeline: TimelineEvent[];
  cancelReason: string | null;
  formatDate: (date: Date | string) => string;
  formatTime: (date: Date | string) => string;
}) {
  // Sort timeline by timestamp descending (most recent first)
  const sortedTimeline = [...timeline].sort((a, b) => {
    const dateA = typeof a.timestamp === "string" ? new Date(a.timestamp) : a.timestamp;
    const dateB = typeof b.timestamp === "string" ? new Date(b.timestamp) : b.timestamp;
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-gray-700">Order Timeline</h3>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {sortedTimeline.map((event, index) => {
            const config = TIMELINE_STATUS_CONFIG[event.status] || {
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
                  {!isLast && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                </div>

                {/* Event content */}
                <div className="flex-1 min-w-0 -mt-0.5">
                  <p className={`font-medium ${config.color}`}>{config.label}</p>
                  <p className="text-sm text-gray-400">
                    {formatDate(event.timestamp)} at {formatTime(event.timestamp)}
                  </p>
                  {event.status === "canceled" && cancelReason && (
                    <p className="text-sm text-red-500 mt-1">Reason: {cancelReason}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Main Component ====================
export function DashboardOrderDetailClient({ order, imageMap }: Props) {
  const formatPrice = useDashboardFormatPrice();
  const { formatDate, formatTime } = useDashboardFormatDateTime(order.merchant.timezone);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/orders"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Order #{order.orderNumber}</h1>
            <PaymentStatusBadge status={order.status as OrderStatus} />
            <FulfillmentStatusBadge status={order.fulfillmentStatus as FulfillmentStatus} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {orderModeLabels[order.orderMode as OrderMode]} &bull; {salesChannelLabels[order.salesChannel as SalesChannel]} &bull; {order.merchant.name}
          </p>
        </div>
      </div>

      {/* Status Progress */}
      <OrderStatusProgress
        paymentStatus={order.status as OrderStatus}
        fulfillmentStatus={order.fulfillmentStatus as FulfillmentStatus}
        orderMode={order.orderMode as OrderMode}
        paymentType={order.paymentType as PaymentType}
        merchantId={order.merchant.id}
        orderId={order.id}
      />

      {/* Two Column Layout for Items and Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Items */}
        <OrderItemsList items={order.items} formatPrice={formatPrice} imageMap={imageMap} />

        {/* Price Summary */}
        <OrderPriceSummary
          subtotal={order.subtotal}
          taxAmount={order.taxAmount}
          tipAmount={order.tipAmount}
          deliveryFee={order.deliveryFee}
          feesAmount={order.feesAmount}
          feesBreakdown={order.feesBreakdown}
          discount={order.discount}
          totalAmount={order.totalAmount}
          formatPrice={formatPrice}
        />
      </div>

      {/* Two Column Layout for Customer Info and Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Info */}
        <CustomerInfo
          customerFirstName={order.customerFirstName}
          customerLastName={order.customerLastName}
          customerPhone={order.customerPhone}
          customerEmail={order.customerEmail}
          orderMode={order.orderMode as OrderMode}
          deliveryAddress={order.deliveryAddress}
          notes={order.notes}
        />

        {/* Timeline */}
        <OrderTimeline
          timeline={order.timeline}
          cancelReason={order.cancelReason}
          formatDate={formatDate}
          formatTime={formatTime}
        />
      </div>
    </div>
  );
}
