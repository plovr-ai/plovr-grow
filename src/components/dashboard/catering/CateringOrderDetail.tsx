"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, formatPhone } from "@/lib/utils";
import { formatCustomerName } from "@/lib/names";
import type { CateringOrderWithRelations, CateringOrderItem } from "@/services/catering/catering-order.types";

interface CateringOrderDetailProps {
  order: CateringOrderWithRelations;
}

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
} as const;

const STATUS_ICONS = {
  draft: Clock,
  sent: Send,
  paid: Check,
  completed: Check,
  cancelled: X,
} as const;

export function CateringOrderDetail({ order }: CateringOrderDetailProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const merchant = order.merchant;
  const currency = merchant.currency || "USD";
  const locale = merchant.locale || "en-US";
  const priceFormatter = (price: number) => formatPrice(price, currency, locale);

  const StatusIcon = STATUS_ICONS[order.status as keyof typeof STATUS_ICONS] || Clock;

  const handleSendInvoice = async () => {
    setLoading(true);
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      const response = await fetch(
        `/api/dashboard/${merchant.id}/catering/orders/${order.id}/send-invoice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dueDate: dueDate.toISOString() }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send invoice");
      }

      router.refresh();
    } catch (error) {
      console.error("Error sending invoice:", error);
      alert(error instanceof Error ? error.message : "Failed to send invoice");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/dashboard/${merchant.id}/catering/orders/${order.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update status");
      }

      router.refresh();
    } catch (error) {
      console.error("Error updating status:", error);
      alert(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/catering/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold">Order {order.orderNumber}</h2>
            <p className="text-sm text-gray-500">{merchant.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${
              STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] ||
              "bg-gray-100 text-gray-800"
            }`}
          >
            <StatusIcon className="h-4 w-4" />
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
          {order.status === "draft" && (
            <Button onClick={handleSendInvoice} disabled={loading}>
              <Send className="mr-2 h-4 w-4" />
              {loading ? "Sending..." : "Send Invoice"}
            </Button>
          )}
          {order.status === "paid" && (
            <Button onClick={() => handleUpdateStatus("completed")} disabled={loading}>
              <Check className="mr-2 h-4 w-4" />
              Mark Completed
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Name</span>
                <p className="font-medium">
                  {formatCustomerName(order.customerFirstName, order.customerLastName)}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Phone</span>
                <p className="font-medium">{formatPhone(order.customerPhone)}</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Email</span>
                <p className="font-medium">{order.customerEmail}</p>
              </div>
            </div>
          </div>

          {/* Event Details */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4">Event Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Event Date</span>
                <p className="font-medium">{formatDate(order.eventDate)}</p>
              </div>
              <div>
                <span className="text-gray-500">Event Time</span>
                <p className="font-medium">{order.eventTime}</p>
              </div>
              <div>
                <span className="text-gray-500">Number of Guests</span>
                <p className="font-medium">{order.guestCount}</p>
              </div>
              {order.eventType && (
                <div>
                  <span className="text-gray-500">Event Type</span>
                  <p className="font-medium capitalize">{order.eventType}</p>
                </div>
              )}
              {order.eventAddress && (
                <div className="col-span-2">
                  <span className="text-gray-500">Event Address</span>
                  <p className="font-medium">{order.eventAddress}</p>
                </div>
              )}
              {order.specialRequests && (
                <div className="col-span-2">
                  <span className="text-gray-500">Special Requests</span>
                  <p className="font-medium">{order.specialRequests}</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4">Order Items</h3>
            <div className="space-y-4">
              {(order.items as CateringOrderItem[]).map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      {priceFormatter(item.unitPrice)} x {item.quantity}
                    </p>
                  </div>
                  <p className="font-medium">{priceFormatter(item.totalPrice)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Internal Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4">Order Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>{priceFormatter(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tax</span>
                <span>{priceFormatter(order.taxAmount)}</span>
              </div>
              {order.serviceCharge > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Service Charge</span>
                  <span>{priceFormatter(order.serviceCharge)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg border-t pt-3">
                <span>Total</span>
                <span>{priceFormatter(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Invoice Info */}
          {order.invoice && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Invoice</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice #</span>
                  <span className="font-mono">{order.invoice.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      order.invoice.status === "paid"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {order.invoice.status}
                  </span>
                </div>
                {order.invoice.sentAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sent</span>
                    <span>
                      {new Date(order.invoice.sentAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {order.invoice.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Paid</span>
                    <span>
                      {new Date(order.invoice.paidAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4">Timeline</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span>{new Date(order.createdAt).toLocaleString()}</span>
              </div>
              {order.sentAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice Sent</span>
                  <span>{new Date(order.sentAt).toLocaleString()}</span>
                </div>
              )}
              {order.paidAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Paid</span>
                  <span>{new Date(order.paidAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
