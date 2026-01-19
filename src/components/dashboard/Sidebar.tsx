"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingCart,
  Settings,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  pattern?: RegExp;
}

const navigation: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    pattern: /^\/dashboard$/,
  },
  {
    label: "Merchants",
    href: "/dashboard/merchants",
    icon: Store,
    pattern: /^\/dashboard\/merchants/,
  },
];

function getMerchantNavigation(merchantId: string): NavItem[] {
  return [
    {
      label: "Overview",
      href: `/dashboard/${merchantId}`,
      icon: LayoutDashboard,
      pattern: new RegExp(`^/dashboard/${merchantId}$`),
    },
    {
      label: "Menu",
      href: `/dashboard/${merchantId}/menu`,
      icon: UtensilsCrossed,
      pattern: new RegExp(`^/dashboard/${merchantId}/menu`),
    },
    {
      label: "Orders",
      href: `/dashboard/${merchantId}/orders`,
      icon: ShoppingCart,
      pattern: new RegExp(`^/dashboard/${merchantId}/orders`),
    },
    {
      label: "Settings",
      href: `/dashboard/${merchantId}/settings`,
      icon: Settings,
      pattern: new RegExp(`^/dashboard/${merchantId}/settings`),
    },
  ];
}

export function Sidebar() {
  const pathname = usePathname();

  // Check if we're on a merchant-specific page
  const merchantMatch = pathname.match(/^\/dashboard\/([^/]+)/);
  const merchantId = merchantMatch?.[1];

  // Determine which navigation to show
  const navItems =
    merchantId && merchantId !== "merchants"
      ? getMerchantNavigation(merchantId)
      : navigation;

  const isActive = (item: NavItem) => {
    if (item.pattern) {
      return item.pattern.test(pathname);
    }
    return pathname === item.href;
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <h1 className="text-xl font-bold text-gray-900">Plovr</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        <p className="text-xs text-gray-500">
          Plovr Dashboard v0.1.0
        </p>
      </div>
    </aside>
  );
}
