"use client";

import Link from "next/link";
import type { MerchantStatus } from "@/types/merchant";

interface LocationCardProps {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  status: MerchantStatus;
  isCurrentLocation: boolean;
}

export function LocationCard({
  slug,
  name,
  address,
  city,
  state,
  status,
  isCurrentLocation,
}: LocationCardProps) {
  const locationLine = [city, state].filter(Boolean).join(", ");

  return (
    <Link
      href={`/r/${slug}/menu`}
      className="block border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow bg-white"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-gray-900 truncate">{name}</h3>
          {address && (
            <p className="mt-1 text-gray-600 text-sm">{address}</p>
          )}
          {locationLine && (
            <p className="text-gray-500 text-sm">{locationLine}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {isCurrentLocation && (
            <span className="bg-theme-primary-light text-theme-primary-hover px-3 py-1 rounded-full text-xs font-medium">
              Current
            </span>
          )}
          {status === "temporarily_closed" && (
            <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-medium">
              Temporarily Closed
            </span>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center text-theme-primary text-sm font-medium">
        <span>View Menu</span>
        <svg
          className="w-4 h-4 ml-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </Link>
  );
}
