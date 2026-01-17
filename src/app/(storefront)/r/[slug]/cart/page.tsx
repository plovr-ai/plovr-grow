"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCartStore, useCartHydration } from "@/stores";
import { useFormatPrice, usePricing } from "@/hooks";
import {
  ArrowLeftIcon,
  CartIcon,
  ImagePlaceholderIcon,
  TrashIcon,
  MinusIcon,
  PlusIcon,
} from "@storefront/components/icons";

export default function CartPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const hydrated = useCartHydration();
  const formatPrice = useFormatPrice();
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);

  const itemCount = items.reduce((count, item) => count + item.quantity, 0);
  const pricing = usePricing(items);

  // Redirect to menu if cart is empty after hydration
  if (hydrated && items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <Link
                href={`/r/${slug}/menu`}
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </Link>
              <h1 className="ml-4 text-lg font-semibold text-gray-900">
                Your Cart
              </h1>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="text-gray-400 mb-4">
            <CartIcon className="w-16 h-16 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Your cart is empty
          </h2>
          <p className="text-gray-500 mb-6">
            Add some delicious items from our menu
          </p>
          <Link
            href={`/r/${slug}/menu`}
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Browse Menu
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link
                href={`/r/${slug}/menu`}
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </Link>
              <h1 className="ml-4 text-lg font-semibold text-gray-900">
                Your Cart ({itemCount} {itemCount === 1 ? "item" : "items"})
              </h1>
            </div>
            <button
              onClick={clearCart}
              className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      {/* Cart Items */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-48">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item.id} className="p-4">
                <div className="flex gap-4">
                  {/* Item Image */}
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      <ImagePlaceholderIcon className="w-8 h-8 text-gray-300" />
                    </div>
                  )}

                  {/* Item Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    {item.selectedModifiers?.length > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        {item.selectedModifiers
                          .map((mod) => mod.modifierName)
                          .join(", ")}
                      </p>
                    )}
                    {item.specialInstructions && (
                      <p className="text-sm text-gray-400 mt-1 italic">
                        {item.specialInstructions}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 mt-1">
                      {formatPrice(item.price)} each
                    </p>
                  </div>

                  {/* Price and Quantity */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">
                      {formatPrice(item.totalPrice)}
                    </p>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        {item.quantity === 1 ? (
                          <TrashIcon className="w-4 h-4 text-red-500" />
                        ) : (
                          <MinusIcon className="w-4 h-4" />
                        )}
                      </button>
                      <span className="w-8 text-center font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Add More Items */}
        <Link
          href={`/r/${slug}/menu`}
          className="mt-4 flex items-center justify-center gap-2 py-3 text-red-600 hover:text-red-700 font-medium transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Add more items
        </Link>
      </main>

      {/* Order Summary - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Summary */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatPrice(pricing.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax</span>
              <span>{formatPrice(pricing.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span>{formatPrice(pricing.totalAmount)}</span>
            </div>
          </div>

          {/* Checkout Button */}
          <Link
            href={`/r/${slug}/checkout`}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-4 rounded-xl transition-colors block text-center"
          >
            Continue to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
