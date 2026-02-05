"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@storefront/components/icons";
import { OrderStatusProgress } from "./OrderStatusProgress";
import { OrderItemsList } from "./OrderItemsList";
import { OrderPriceSummary } from "./OrderPriceSummary";
import { CustomerInfo } from "./CustomerInfo";
import { OrderTimeline } from "./OrderTimeline";
import { LoyaltyRegistrationCTA } from "./LoyaltyRegistrationCTA";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import type { OrderDetailData, TimelineEvent } from "./order-detail.types";
import type { OrderStatus, OrderMode, OrderItemData } from "@/types";

interface Props {
  order: OrderDetailData;
  merchantSlug: string;
  imageMap: Record<string, string | null>;
}

interface SSEMessage {
  type: "connected" | "status_changed";
  status?: OrderStatus;
  previousStatus?: OrderStatus;
  timestamp?: string;
}

export function OrderDetailClient({ order: initialOrder, merchantSlug, imageMap }: Props) {
  const [order, setOrder] = useState<OrderDetailData>(initialOrder);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const { member } = useLoyalty();

  // SSE connection for real-time updates
  useEffect(() => {
    // Don't connect if order is in terminal state
    if (order.status === "completed" || order.status === "cancelled") {
      setConnectionStatus("disconnected");
      return;
    }

    let eventSource: EventSource;
    let retryCount = 0;
    const maxRetries = 5;

    const connect = () => {
      eventSource = new EventSource(
        `/api/storefront/r/${merchantSlug}/orders/${order.id}/events`
      );

      eventSource.onopen = () => {
        setConnectionStatus("connected");
        retryCount = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data: SSEMessage = JSON.parse(event.data);

          if (data.type === "status_changed" && data.status && data.timestamp) {
            setOrder((prev) => {
              const newTimeline: TimelineEvent[] = [
                ...prev.timeline,
                { status: data.status!, timestamp: data.timestamp! },
              ];

              return {
                ...prev,
                status: data.status!,
                timeline: newTimeline,
              };
            });
          }
        } catch (error) {
          console.error("Failed to parse SSE message:", error);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setConnectionStatus("disconnected");

        // Exponential backoff retry
        if (retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          retryCount++;
          setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      eventSource?.close();
    };
  }, [merchantSlug, order.id, order.status]);

  // Parse items from JSON if needed
  const items: OrderItemData[] = Array.isArray(order.items)
    ? order.items
    : JSON.parse(order.items as unknown as string);

  const orderModeLabelMap: Record<OrderMode, string> = {
    pickup: "Pickup",
    delivery: "Delivery",
    dine_in: "Dine In",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link
                href={`/r/${merchantSlug}/menu`}
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </Link>
              <div className="ml-4">
                <h1 className="text-lg font-semibold text-gray-900">
                  Order #{order.orderNumber}
                </h1>
                <p className="text-sm text-gray-500">
                  {orderModeLabelMap[order.orderMode as OrderMode]}
                </p>
              </div>
            </div>
            {/* Connection status indicator */}
            {order.status !== "completed" && order.status !== "cancelled" && (
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus === "connected"
                      ? "bg-green-500"
                      : connectionStatus === "connecting"
                        ? "bg-yellow-500 animate-pulse"
                        : "bg-gray-400"
                  }`}
                />
                <span className="text-xs text-gray-400">
                  {connectionStatus === "connected"
                    ? "Live"
                    : connectionStatus === "connecting"
                      ? "Connecting..."
                      : "Offline"}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* Status Progress */}
        <OrderStatusProgress
          currentStatus={order.status as OrderStatus}
          orderMode={order.orderMode as OrderMode}
        />

        {/* Loyalty Registration CTA (for non-members) */}
        <LoyaltyRegistrationCTA
          orderId={order.id}
          customerPhone={order.customerPhone}
          customerFirstName={order.customerFirstName}
          customerLastName={order.customerLastName}
          customerEmail={order.customerEmail}
          subtotal={Number(order.subtotal)}
        />

        {/* Order Items */}
        <OrderItemsList items={items} imageMap={imageMap} />

        {/* Price Summary */}
        <OrderPriceSummary
          subtotal={Number(order.subtotal)}
          taxAmount={Number(order.taxAmount)}
          tipAmount={Number(order.tipAmount)}
          deliveryFee={Number(order.deliveryFee)}
          discount={Number(order.discount)}
          totalAmount={Number(order.totalAmount)}
          pointsEarned={order.pointsEarned}
          member={member}
        />

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
        />
      </main>
    </div>
  );
}
