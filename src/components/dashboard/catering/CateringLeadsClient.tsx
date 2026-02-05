"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/orders/Pagination";
import { formatPhone } from "@/lib/utils";
import { formatCustomerName } from "@/lib/names";
import type { CateringLeadWithMerchant } from "@/services/catering/catering.types";

interface CateringLeadsClientProps {
  leads: CateringLeadWithMerchant[];
  totalPages: number;
  currentPage: number;
  total: number;
  merchants: Array<{ id: string; name: string }>;
  initialFilters: {
    search: string;
    status: string;
    merchantId: string;
  };
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "contacted", label: "Contacted" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-800",
  contacted: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
} as const;

export function CateringLeadsClient({
  leads,
  totalPages,
  currentPage,
  total,
  merchants,
  initialFilters,
}: CateringLeadsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Catering Leads</h2>
        <p className="text-sm text-gray-500">
          View and manage catering inquiries ({total} total)
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4">
        <Select
          value={initialFilters.merchantId}
          onChange={(e) => updateFilters({ merchantId: e.target.value })}
        >
          <option value="all">All Locations</option>
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

        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[300px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </form>
      </div>

      {/* Leads Table */}
      {leads.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
          <p className="text-gray-500">No catering leads found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Submitted
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {formatCustomerName(lead.firstName, lead.lastName)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {formatPhone(lead.phone)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {lead.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {lead.notes || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {lead.merchant.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          STATUS_COLORS[
                            lead.status as keyof typeof STATUS_COLORS
                          ] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {formatDate(lead.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
