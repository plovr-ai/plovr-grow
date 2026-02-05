"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/orders/Pagination";
import { useDashboardFormatPrice } from "@/hooks";
import { formatPhone } from "@/lib/utils";
import { formatCustomerName } from "@/lib/names";
import type { LoyaltyMemberData } from "@/services/loyalty/loyalty.types";

interface LoyaltyMembersClientProps {
  members: LoyaltyMemberData[];
  totalPages: number;
  currentPage: number;
  total: number;
  initialFilters: {
    search: string;
  };
}

export function LoyaltyMembersClient({
  members,
  totalPages,
  currentPage,
  total,
  initialFilters,
}: LoyaltyMembersClientProps) {
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

  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Loyalty Members</h2>
        <p className="text-sm text-gray-500">
          View and manage your loyalty program members ({total} total)
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[300px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by phone, name, or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </form>

      </div>

      {/* Members Table */}
      {members.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
          <p className="text-gray-500">No members found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Points
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Orders
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Total Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Enrolled
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    <Link
                      href={`/dashboard/loyalty/members/${member.id}`}
                      className="block hover:text-blue-600"
                    >
                      {formatPhone(member.phone)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    <Link
                      href={`/dashboard/loyalty/members/${member.id}`}
                      className="block hover:text-blue-600"
                    >
                      {member.firstName || member.lastName ? formatCustomerName(member.firstName || "", member.lastName || "") : "-"}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">
                    <Link
                      href={`/dashboard/loyalty/members/${member.id}`}
                      className="block hover:text-blue-600"
                    >
                      {member.points.toLocaleString()}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                    <Link
                      href={`/dashboard/loyalty/members/${member.id}`}
                      className="block hover:text-blue-600"
                    >
                      {member.totalOrders}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                    <Link
                      href={`/dashboard/loyalty/members/${member.id}`}
                      className="block hover:text-blue-600"
                    >
                      {formatPrice(member.totalSpent)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <Link
                      href={`/dashboard/loyalty/members/${member.id}`}
                      className="block hover:text-blue-600"
                    >
                      {formatDate(member.enrolledAt)}
                    </Link>
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
