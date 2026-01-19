"use client";

import Link from "next/link";
import type { MerchantStatus, BusinessHoursMap } from "@/types/merchant";

interface LocationCardProps {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  businessHours: BusinessHoursMap | null;
  status: MerchantStatus;
  isCurrentLocation: boolean;
  /** Menu item ID to add to cart after navigating to menu */
  addItem?: string;
}

// Helper to get today's business hours
function getTodayHours(businessHours: BusinessHoursMap | null): string | null {
  if (!businessHours) return null;

  // Use abbreviated day keys to match database format
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const today = days[new Date().getDay()];
  const todayHours = businessHours[today];

  if (!todayHours) {
    return null;
  }

  if (todayHours.closed) {
    return "Closed today";
  }

  return `${todayHours.open} - ${todayHours.close}`;
}

export function LocationCard({
  slug,
  name,
  address,
  city,
  state,
  phone,
  email,
  businessHours,
  status,
  isCurrentLocation,
  addItem,
}: LocationCardProps) {
  const locationLine = [city, state].filter(Boolean).join(", ");
  const todayHours = getTodayHours(businessHours);

  // Generate menu link with optional addItem param
  const menuLink = addItem
    ? `/r/${slug}/menu?addItem=${addItem}`
    : `/r/${slug}/menu`;

  return (
    <Link
      href={menuLink}
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

      {/* Contact & Hours */}
      <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
        {phone && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            <span>{phone}</span>
          </div>
        )}
        {email && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span>{email}</span>
          </div>
        )}
        {todayHours && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Today: {todayHours}</span>
          </div>
        )}
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
