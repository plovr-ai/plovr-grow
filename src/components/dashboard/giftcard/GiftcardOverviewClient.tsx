"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, CreditCard, DollarSign, TrendingDown, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/orders/Pagination";
import { useDashboardFormatPrice } from "@/hooks";
import { formatCustomerName } from "@/lib/names";
import { cn } from "@/lib/utils";
import type { GiftCardStats, GiftCardWithOrder } from "@/services/giftcard";

interface GiftcardOverviewClientProps {
  stats: GiftCardStats;
  giftCards: GiftCardWithOrder[];
  totalPages: number;
  currentPage: number;
  total: number;
  initialFilters: {
    status: string;
    search: string;
  };
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "depleted", label: "Depleted" },
  { value: "disabled", label: "Disabled" },
] as const;

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subValue?: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn("rounded-lg p-2", iconColor)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
          {subValue && <p className="text-xs text-gray-400">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: "bg-green-100 text-green-800",
    depleted: "bg-gray-100 text-gray-800",
    disabled: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        styles[status as keyof typeof styles] ?? styles.active
      )}
    >
      {status}
    </span>
  );
}

export function GiftcardOverviewClient({
  stats,
  giftCards,
  totalPages,
  currentPage,
  total,
  initialFilters,
}: GiftcardOverviewClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formatPrice = useDashboardFormatPrice();
  const [searchInput, setSearchInput] = useState(initialFilters.search);

  const updateFilters = (updates: Partial<typeof initialFilters>) => {
    const params = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === "all" || !value) {
        params.delete(key);
      } else {
        params.set(key, value);
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchInput });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Gift Cards</h2>
        <p className="text-sm text-gray-500">
          Manage and track your gift card program ({total} total)
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CreditCard}
          label="Total Gift Cards"
          value={stats.totalCards}
          subValue={`${stats.activeCards} active`}
          iconColor="bg-blue-500"
        />
        <StatCard
          icon={DollarSign}
          label="Total Value Sold"
          value={formatPrice(stats.totalValueSold)}
          iconColor="bg-green-500"
        />
        <StatCard
          icon={TrendingDown}
          label="Total Redeemed"
          value={formatPrice(stats.totalRedeemed)}
          iconColor="bg-orange-500"
        />
        <StatCard
          icon={Wallet}
          label="Active Balance"
          value={formatPrice(stats.activeBalance)}
          iconColor="bg-purple-500"
        />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4">
        <form onSubmit={handleSearchSubmit} className="min-w-[300px] flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by card number, name, or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </form>

        <select
          value={initialFilters.status}
          onChange={(e) => updateFilters({ status: e.target.value })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Gift Cards Table */}
      {giftCards.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
          <p className="text-gray-500">No gift cards found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Card Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Customer
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Initial Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Balance
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {giftCards.map((giftCard) => (
                <tr key={giftCard.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-900">
                    {giftCard.cardNumber}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    <div>
                      {formatCustomerName(
                        giftCard.purchaseOrder.customerFirstName,
                        giftCard.purchaseOrder.customerLastName
                      )}
                    </div>
                    {giftCard.purchaseOrder.customerEmail && (
                      <div className="text-xs text-gray-500">
                        {giftCard.purchaseOrder.customerEmail}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                    {formatPrice(giftCard.initialAmount)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">
                    {formatPrice(giftCard.currentBalance)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <StatusBadge status={giftCard.status} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatDate(giftCard.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
