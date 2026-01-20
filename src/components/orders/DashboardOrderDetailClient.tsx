"use client";

import Link from "next/link";
import { ArrowLeft, User, Phone, Mail, MapPin, FileText } from "lucide-react";
import { useDashboardFormatPrice, useDashboardFormatDateTime } from "@/hooks";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { OrderStatus, OrderType, OrderItemData, DeliveryAddress } from "@/types";

// Types for Dashboard Order Detail
interface TimelineEvent {
  status: OrderStatus;
  timestamp: Date | string;
}

interface DashboardOrderDetailData {
  id: string;
  orderNumber: string;
  status: string;
  orderType: string;
  items: OrderItemData[];
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: DeliveryAddress | null;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  deliveryFee: number;
  discount: number;
  totalAmount: number;
  createdAt: Date | string;
  confirmedAt: Date | string | null;
  completedAt: Date | string | null;
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

const orderTypeLabels: Record<OrderType, string> = {
  pickup: "Pickup",
  delivery: "Delivery",
  dine_in: "Dine In",
};

// ==================== Order Status Progress ====================
interface StatusStep {
  status: OrderStatus;
  label: string;
}

const STEPS: StatusStep[] = [
  { status: "pending", label: "Placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready" },
  { status: "completed", label: "Completed" },
];

const STATUS_ORDER: Record<OrderStatus, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  completed: 4,
  cancelled: -1,
};

function OrderStatusProgress({
  currentStatus,
  orderType,
}: {
  currentStatus: OrderStatus;
  orderType: OrderType;
}) {
  const currentIndex = STATUS_ORDER[currentStatus];
  const isCancelled = currentStatus === "cancelled";

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

  const readyLabel = orderType === "delivery" ? "Out for Delivery" : "Ready for Pickup";
  const stepsWithLabels = STEPS.map((step) =>
    step.status === "ready" ? { ...step, label: readyLabel } : step
  );

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          {stepsWithLabels.map((step, index) => {
            const stepIndex = STATUS_ORDER[step.status];
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
                  <img
                    src={imageUrl}
                    alt={item.name}
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
  discount,
  totalAmount,
  formatPrice,
}: {
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  deliveryFee: number;
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
  customerName,
  customerPhone,
  customerEmail,
  orderType,
  deliveryAddress,
  notes,
}: {
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  orderType: OrderType;
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
            <span>{customerName}</span>
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
        {orderType === "delivery" && deliveryAddress && (
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
const TIMELINE_STATUS_CONFIG: Record<
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
            const config = TIMELINE_STATUS_CONFIG[event.status];
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
                  {event.status === "cancelled" && cancelReason && (
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
            <StatusBadge status={order.status as OrderStatus} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {orderTypeLabels[order.orderType as OrderType]} &bull; {order.merchant.name}
          </p>
        </div>
      </div>

      {/* Status Progress */}
      <OrderStatusProgress
        currentStatus={order.status as OrderStatus}
        orderType={order.orderType as OrderType}
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
          discount={order.discount}
          totalAmount={order.totalAmount}
          formatPrice={formatPrice}
        />
      </div>

      {/* Two Column Layout for Customer Info and Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Info */}
        <CustomerInfo
          customerName={order.customerName}
          customerPhone={order.customerPhone}
          customerEmail={order.customerEmail}
          orderType={order.orderType as OrderType}
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
