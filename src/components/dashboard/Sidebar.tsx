"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingCart,
  Settings,
  List,
  Receipt,
  ChevronDown,
  Building2,
  Gift,
  Sparkles,
  Users,
  Star,
  Utensils,
  CreditCard,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  pattern?: RegExp;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    pattern: /^\/dashboard$/,
  },
  {
    label: "Menu",
    href: "/dashboard/menu",
    icon: UtensilsCrossed,
    pattern: /^\/dashboard\/menu/,
    children: [
      {
        label: "Items",
        href: "/dashboard/menu",
        icon: List,
        pattern: /^\/dashboard\/menu$/,
      },
      {
        label: "Featured",
        href: "/dashboard/menu/featured",
        icon: Star,
        pattern: /^\/dashboard\/menu\/featured/,
      },
      {
        label: "Tax",
        href: "/dashboard/menu/tax",
        icon: Receipt,
        pattern: /^\/dashboard\/menu\/tax/,
      },
    ],
  },
  {
    label: "Orders",
    href: "/dashboard/orders",
    icon: ShoppingCart,
    pattern: /^\/dashboard\/orders/,
  },
  {
    label: "Loyalty",
    href: "/dashboard/loyalty",
    icon: Gift,
    pattern: /^\/dashboard\/loyalty/,
    children: [
      {
        label: "Rules",
        href: "/dashboard/loyalty/rules",
        icon: Sparkles,
        pattern: /^\/dashboard\/loyalty\/rules/,
      },
      {
        label: "Members",
        href: "/dashboard/loyalty/members",
        icon: Users,
        pattern: /^\/dashboard\/loyalty\/members/,
      },
    ],
  },
  {
    label: "Catering",
    href: "/dashboard/catering",
    icon: Utensils,
    pattern: /^\/dashboard\/catering/,
    children: [
      {
        label: "Orders",
        href: "/dashboard/catering/orders",
        icon: Receipt,
        pattern: /^\/dashboard\/catering\/orders/,
      },
      {
        label: "Leads",
        href: "/dashboard/catering/leads",
        icon: List,
        pattern: /^\/dashboard\/catering\/leads/,
      },
    ],
  },
  {
    label: "Gift Cards",
    href: "/dashboard/giftcard",
    icon: CreditCard,
    pattern: /^\/dashboard\/giftcard/,
  },
  {
    label: "Company",
    href: "/dashboard/tenant",
    icon: Building2,
    pattern: /^\/dashboard\/tenant/,
  },
  {
    label: "Subscription",
    href: "/dashboard/subscription",
    icon: Crown,
    pattern: /^\/dashboard\/subscription/,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    pattern: /^\/dashboard\/settings/,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const isActive = (item: NavItem) => {
    if (item.pattern) {
      return item.pattern.test(pathname);
    }
    return pathname === item.href;
  };

  const isChildActive = (item: NavItem) => {
    if (!item.children) return false;
    return item.children.some((child) => isActive(child));
  };

  // Auto-expand parent when child is active
  useEffect(() => {
    navigation.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some((child) => {
          if (child.pattern) {
            return child.pattern.test(pathname);
          }
          return pathname === child.href;
        });
        if (hasActiveChild) {
          setExpandedItems((prev) => new Set(prev).add(item.href));
        }
      }
    });
  }, [pathname]);

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  };

  const renderNavItem = (item: NavItem, depth: number = 0) => {
    const Icon = item.icon;
    const active = isActive(item);
    const childActive = isChildActive(item);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.href);

    if (hasChildren) {
      return (
        <div key={item.href}>
          <button
            onClick={() => toggleExpanded(item.href)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active || childActive
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1">
              {item.children!.map((child) => renderNavItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          depth > 0 && "pl-6",
          active
            ? "bg-gray-100 text-gray-900"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        )}
      >
        <Icon className={cn("shrink-0", depth > 0 ? "h-4 w-4" : "h-5 w-5")} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <h1 className="text-xl font-bold text-gray-900">Plovr</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => renderNavItem(item))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        <p className="text-xs text-gray-500">Plovr Dashboard v0.1.0</p>
      </div>
    </aside>
  );
}
