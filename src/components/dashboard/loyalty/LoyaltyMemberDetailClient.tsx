"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  Award,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/orders/Pagination";
import { StatusBadge } from "@/components/orders/StatusBadge";
import {
  useDashboardFormatPrice,
  useDashboardFormatDateTime,
} from "@/hooks";
import { formatPhone } from "@/lib/utils";
import type { OrderStatus, OrderType } from "@/types";

// ==================== Types ====================

interface LoyaltyMemberDetailClientProps {
  member: {
    id: string;
    phone: string;
    email: string | null;
    name: string | null;
    points: number;
    totalOrders: number;
    totalSpent: number;
    lastOrderAt: Date | string | null;
    enrolledAt: Date | string;
  };
  orders: {
    items: Array<{
      id: string;
      orderNumber: string;
      status: string;
      orderType: string;
      totalAmount: number;
      createdAt: Date | string;
      merchant: {
        id: string;
        name: string;
        slug: string;
        timezone: string;
      } | null;
    }>;
    total: number;
    totalPages: number;
  } | null;
  points: {
    items: Array<{
      id: string;
      type: string;
      points: number;
      balanceAfter: number;
      description: string | null;
      createdAt: Date | string;
      merchant?: {
        id: string;
        name: string;
        slug: string;
      } | null;
      order?: {
        id: string;
        orderNumber: string;
      } | null;
    }>;
    total: number;
    totalPages: number;
  } | null;
  currentTab: string;
  currentPage: number;
}

// ==================== Constants ====================

const orderTypeLabels: Record<OrderType, string> = {
  pickup: "Pickup",
  delivery: "Delivery",
  dine_in: "Dine In",
};

const pointTypeLabels = {
  earn: "Earned",
  redeem: "Redeemed",
  adjust: "Adjustment",
  expire: "Expired",
};

const pointTypeColors = {
  earn: "text-green-600",
  redeem: "text-red-600",
  adjust: "text-blue-600",
  expire: "text-gray-600",
};

// ==================== Sub-Components ====================

function MemberInfoCard({
  member,
  formatDate,
}: {
  member: LoyaltyMemberDetailClientProps["member"];
  formatDate: (date: Date | string) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-gray-700">
          Member Information
        </h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-gray-600">
          <User className="h-4 w-4 text-gray-400" />
          <span>{member.name || "-"}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Phone className="h-4 w-4 text-gray-400" />
          <span>{formatPhone(member.phone)}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Mail className="h-4 w-4 text-gray-400" />
          <span>{member.email || "-"}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span>Enrolled {formatDate(member.enrolledAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function MemberStatsCard({
  member,
  formatPrice,
  formatDate,
}: {
  member: LoyaltyMemberDetailClientProps["member"];
  formatPrice: (amount: number) => string;
  formatDate: (date: Date | string) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-gray-700">Statistics</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600">
            <Award className="h-4 w-4 text-gray-400" />
            <span>Points Balance</span>
          </div>
          <span className="text-lg font-semibold text-green-600">
            {member.points.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Total Orders</span>
          <span className="font-medium">{member.totalOrders}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Total Spent</span>
          <span className="font-medium">{formatPrice(member.totalSpent)}</span>
        </div>
        {member.lastOrderAt && (
          <div className="flex justify-between text-gray-600">
            <span>Last Order</span>
            <span className="font-medium">
              {formatDate(member.lastOrderAt)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TabNavigation({
  currentTab,
  onTabChange,
}: {
  currentTab: string;
  onTabChange: (tab: string) => void;
}) {
  const tabs = [
    { id: "orders", label: "Orders" },
    { id: "points", label: "Points History" },
  ];

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              border-b-2 px-1 py-4 text-sm font-medium transition-colors
              ${
                currentTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function OrdersTab({
  orders,
  formatPrice,
  formatDate,
  currentPage,
  onPageChange,
}: {
  orders: LoyaltyMemberDetailClientProps["orders"];
  formatPrice: (amount: number) => string;
  formatDate: (date: Date | string) => string;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  if (!orders || orders.items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">No orders found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Order #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Merchant
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {orders.items.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        #{order.orderNumber}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={order.status as OrderStatus} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {orderTypeLabels[order.orderType as OrderType]}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {order.merchant?.name || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {formatPrice(order.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Pagination
        currentPage={currentPage}
        totalPages={orders.totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function PointsHistoryTab({
  points,
  formatDate,
  currentPage,
  onPageChange,
}: {
  points: LoyaltyMemberDetailClientProps["points"];
  formatDate: (date: Date | string) => string;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  if (!points || points.items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">No point transactions found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Points
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Balance After
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {points.items.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {formatDate(tx.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`text-sm font-medium ${
                          pointTypeColors[
                            tx.type as keyof typeof pointTypeColors
                          ]
                        }`}
                      >
                        {pointTypeLabels[tx.type as keyof typeof pointTypeLabels]}
                      </span>
                    </td>
                    <td
                      className={`whitespace-nowrap px-6 py-4 text-right text-sm font-medium ${
                        tx.points > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {tx.points > 0 ? "+" : ""}
                      {tx.points.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                      {tx.balanceAfter.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tx.description || "-"}
                      {tx.order && (
                        <>
                          {" "}
                          <Link
                            href={`/dashboard/orders/${tx.order.id}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            (Order #{tx.order.orderNumber})
                          </Link>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Pagination
        currentPage={currentPage}
        totalPages={points.totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}

// ==================== Main Component ====================

export function LoyaltyMemberDetailClient({
  member,
  orders,
  points,
  currentTab,
  currentPage,
}: LoyaltyMemberDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formatPrice = useDashboardFormatPrice();
  const { formatDate } = useDashboardFormatDateTime();

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    params.delete("page"); // Reset to page 1 when changing tabs
    router.push(`?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/loyalty/members"
          className="rounded-lg p-2 transition-colors hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {member.name || formatPhone(member.phone)}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Loyalty Member Details</p>
        </div>
      </div>

      {/* Two Column Layout for Info and Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MemberInfoCard member={member} formatDate={formatDate} />
        <MemberStatsCard
          member={member}
          formatPrice={formatPrice}
          formatDate={formatDate}
        />
      </div>

      {/* Tab Navigation */}
      <TabNavigation
        currentTab={currentTab}
        onTabChange={handleTabChange}
      />

      {/* Tab Content */}
      {currentTab === "orders" && (
        <OrdersTab
          orders={orders}
          formatPrice={formatPrice}
          formatDate={formatDate}
          currentPage={currentPage}
          onPageChange={handlePageChange}
        />
      )}

      {currentTab === "points" && (
        <PointsHistoryTab
          points={points}
          formatDate={formatDate}
          currentPage={currentPage}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
