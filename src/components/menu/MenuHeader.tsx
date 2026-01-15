"use client";

import Link from "next/link";
import { useCartStore, useCartHydration } from "@/stores";
import { useFormatPrice } from "@/hooks";

interface MenuHeaderProps {
  merchantName: string;
  merchantLogo: string | null;
  tenantSlug: string;
}

export function MenuHeader({
  merchantName,
  merchantLogo,
  tenantSlug,
}: MenuHeaderProps) {
  const hydrated = useCartHydration();
  const formatPrice = useFormatPrice();
  const itemCount = useCartStore((state) =>
    state.items.reduce((count, item) => count + item.quantity, 0)
  );
  const subtotal = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.totalPrice, 0)
  );

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href={`/r/${tenantSlug}`}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </Link>
              <div className="flex items-center gap-3">
                {merchantLogo && (
                  <img
                    src={merchantLogo}
                    alt={merchantName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                )}
                <span className="font-semibold text-gray-900">{merchantName}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Cart Button */}
      {hydrated && itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-white via-white to-transparent pb-safe">
          <div className="max-w-3xl mx-auto">
            <Link
              href={`/r/${tenantSlug}/checkout`}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-4 px-6 flex items-center justify-between shadow-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="bg-red-500 text-white text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
                <span className="font-semibold text-lg">View Cart</span>
              </div>
              <span className="font-bold text-lg">{formatPrice(subtotal)}</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
