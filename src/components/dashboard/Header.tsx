"use client";

import { LogOut, User } from "lucide-react";
import { signOutAction } from "@/app/(dashboard)/dashboard/actions";
import { useDashboard } from "@/contexts";

export function Header() {
  const { tenant } = useDashboard();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-3">
        {tenant.logoUrl && (
          <img
            src={tenant.logoUrl}
            alt={`${tenant.name} logo`}
            className="h-8 w-8 rounded-md object-contain"
          />
        )}
        <h1 className="text-lg font-semibold text-gray-900">{tenant.name}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* User info */}
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-gray-500" />
        </div>

        {/* Sign out button */}
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
