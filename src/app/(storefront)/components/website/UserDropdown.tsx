"use client";

import { useEffect, useRef } from "react";
import type { LoyaltyMember } from "@/contexts";
import { useFormatPhone } from "@/hooks";

interface UserDropdownProps {
  member: LoyaltyMember;
  onLogout: () => void;
  onClose: () => void;
}

export function UserDropdown({ member, onLogout, onClose }: UserDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const formatPhone = useFormatPhone();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleLogout = async () => {
    await onLogout();
    onClose();
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50"
    >
      {/* Member Info */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="text-sm font-medium text-gray-900 truncate">
          {member.firstName || formatPhone(member.phone)}
        </div>
        <div className="flex items-center gap-1 mt-1">
          <svg
            className="w-4 h-4 text-theme-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
            />
          </svg>
          <span className="text-sm font-semibold text-theme-primary">
            {member.points} pts
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="py-1">
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
