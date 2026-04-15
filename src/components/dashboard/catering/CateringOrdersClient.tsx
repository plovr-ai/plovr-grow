"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Plus, Send, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/orders/Pagination";
import { formatPhone } from "@/lib/utils";
import { formatCustomerName } from "@/lib/names";
import { useDashboardFormatPrice, useDashboardFormatDateTime } from "@/hooks";
import { getApiErrorMessage } from "@/lib/api";
import { OrderViewTabs } from "./OrderViewTabs";
import { OrderCalendar } from "./OrderCalendar";
import type { CateringOrderData, CateringOrderInvoice } from "@/services/catering/catering-order.types";

interface CateringOrdersClientProps {
  orders: (CateringOrderData & {
    merchant: { id: string; name: string; slug: string };
    invoice: CateringOrderInvoice | null;
  })[];
  totalPages: number;
  currentPage: number;
  total: number;
  merchants: Array<{ id: string; name: string; timezone: string }>;
  defaultMerchantId?: string;
  initialFilters: {
    search: string;
    status: string;
    merchantId: string;
    dateFrom: string;
    dateTo: string;
  };
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Invoice Sent" },
  { value: "paid", label: "Paid" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
} as const;

export function CateringOrdersClient({
  orders,
  totalPages,
  currentPage,
  total,
  merchants,
  defaultMerchantId,
  initialFilters,
}: CateringOrdersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formatPrice = useDashboardFormatPrice();
  const [searchInput, setSearchInput] = useState(initialFilters.search);
  const [sendingInvoice, setSendingInvoice] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get view from URL params, default to "calendar"
  const view = (searchParams.get("view") as "calendar" | "list") || "calendar";

  // Get selected merchant's timezone
  const selectedMerchant = merchants.find(m => m.id === initialFilters.merchantId) || merchants[0];
  const { formatDate } = useDashboardFormatDateTime(selectedMerchant?.timezone);

  const updateFilters = (updates: Partial<typeof initialFilters & { view: string }>) => {
    const params = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      // merchantId should always be set (no "all" option for catering)
      if (key === "merchantId") {
        if (value) {
          params.set(key, value);
        }
      } else if (value === "all" || !value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // Reset to page 1 when filters change (except for view change)
    if (!("view" in updates)) {
      params.delete("page");
    }

    router.push(`?${params.toString()}`);
  };

  const handleViewChange = (newView: "calendar" | "list") => {
    updateFilters({ view: newView });
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    router.push(`?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchInput });
  };

  const handleSendInvoice = async (orderId: string, merchantId: string) => {
    setSendingInvoice(orderId);
    try {
      // Default due date: 7 days from now
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      const response = await fetch(
        `/api/dashboard/${merchantId}/catering/orders/${orderId}/send-invoice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dueDate: dueDate.toISOString() }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(getApiErrorMessage(data.error, "Failed to send invoice"));
      }

      // Refresh the page to show updated status
      router.refresh();
    } catch (error) {
      console.error("Error sending invoice:", error);
      alert(error instanceof Error ? error.message : "Failed to send invoice");
    } finally {
      setSendingInvoice(null);
    }
  };

  const formatEventDate = (date: Date, time: string) => {
    return `${formatDate(date)} at ${time}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Catering Orders</h2>
          <p className="text-sm text-gray-500">
            Manage catering orders and invoices ({total} total)
          </p>
        </div>
        <div className="flex items-center gap-4">
          <OrderViewTabs activeView={view} onViewChange={handleViewChange} />
          <Link href={`/dashboard/catering/orders/new?merchantId=${defaultMerchantId}`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select
          value={initialFilters.merchantId || defaultMerchantId}
          onChange={(e) => updateFilters({ merchantId: e.target.value })}
        >
          {merchants.map((merchant) => (
            <option key={merchant.id} value={merchant.id}>
              {merchant.name}
            </option>
          ))}
        </Select>

        <Select
          value={initialFilters.status}
          onChange={(e) => updateFilters({ status: e.target.value })}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {view === "list" && (
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by order #, name, phone..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
          </form>
        )}
      </div>

      {/* Calendar View */}
      {view === "calendar" && (
        <OrderCalendar
          orders={orders}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          defaultMerchantId={defaultMerchantId}
          timezone={selectedMerchant?.timezone}
        />
      )}

      {/* List View */}
      {view === "list" && (
        <>
          {orders.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
              <p className="text-gray-500">No catering orders found</p>
              <Link href={`/dashboard/catering/orders/new?merchantId=${defaultMerchantId}`}>
                <Button variant="outline" className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first catering order
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Order #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Event Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Guests
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Location
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          <Link
                            href={`/dashboard/catering/orders/${order.id}`}
                            className="hover:text-blue-600"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div>
                            {formatCustomerName(order.customerFirstName, order.customerLastName)}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {formatPhone(order.customerPhone)}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {formatEventDate(order.eventDate, order.eventTime)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {order.guestCount}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {formatPrice(order.totalAmount)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] ||
                              "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {order.merchant.name}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/dashboard/catering/orders/${order.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {order.status === "draft" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendInvoice(order.id, order.merchant.id)}
                                disabled={sendingInvoice === order.id}
                              >
                                <Send className="mr-1 h-4 w-4" />
                                {sendingInvoice === order.id ? "Sending..." : "Send Invoice"}
                              </Button>
                            )}
                            {order.invoice?.sentAt && !order.invoice?.paidAt && (
                              <span className="text-xs text-gray-500">Invoice sent</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination - only for list view */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}
