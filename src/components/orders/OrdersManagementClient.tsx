"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Order } from "@prisma/client";
import { LocationFilter } from "./LocationFilter";
import { OrderFilters } from "./OrderFilters";
import { OrderCard } from "./OrderCard";
import { Pagination } from "./Pagination";

// Serialized order type with Decimal fields converted to numbers
export type SerializedOrder = Omit<Order, "tenant" | "subtotal" | "taxAmount" | "tipAmount" | "deliveryFee" | "discount" | "giftCardPayment" | "cashPayment" | "totalAmount"> & {
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  deliveryFee: number;
  discount: number;
  giftCardPayment: number;
  cashPayment: number;
  totalAmount: number;
  merchant?: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  } | null;
};

interface OrdersManagementClientProps {
  merchants: Array<{ id: string; name: string }>;
  initialOrders: SerializedOrder[];
  totalPages: number;
  currentPage: number;
  initialFilters: {
    merchantId: string;
    status: string;
    orderMode: string;
    salesChannel: string;
    dateFrom: string;
    dateTo: string;
  };
}

export function OrdersManagementClient({
  merchants,
  initialOrders,
  totalPages,
  currentPage,
  initialFilters,
}: OrdersManagementClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilters = (updates: Partial<typeof initialFilters>) => {
    const params = new URLSearchParams(searchParams);

    // Map internal filter names to URL parameter names
    const paramKeyMap: Record<string, string> = {
      orderMode: "mode",
      merchantId: "merchantId",
      status: "status",
      salesChannel: "salesChannel",
      dateFrom: "dateFrom",
      dateTo: "dateTo",
    };

    Object.entries(updates).forEach(([key, value]) => {
      const paramKey = paramKeyMap[key] || key;

      if (value === "all" || !value) {
        params.delete(paramKey);
      } else {
        params.set(paramKey, value);
      }
    });

    // Reset to page 1 when filters change
    params.delete("page");

    router.push(`?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Orders Management</h2>
      </div>

      {/* Location Filter (only if multiple merchants) */}
      <LocationFilter
        merchants={merchants}
        value={initialFilters.merchantId}
        onChange={(merchantId) => updateFilters({ merchantId })}
      />

      {/* Other Filters */}
      <OrderFilters
        filters={{
          status: initialFilters.status,
          orderMode: initialFilters.orderMode,
          salesChannel: initialFilters.salesChannel,
          dateFrom: initialFilters.dateFrom,
          dateTo: initialFilters.dateTo,
        }}
        onChange={(filterUpdates) => updateFilters(filterUpdates)}
      />

      {/* Orders Grid */}
      {initialOrders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No orders found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
