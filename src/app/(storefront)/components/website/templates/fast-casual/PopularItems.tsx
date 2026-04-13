"use client";

import Image from "next/image";
import { useFormatPrice } from "@/hooks";
import { ImagePlaceholderIcon } from "@storefront/components/icons";
import type { FeaturedItem } from "@/types/website";

interface PopularItemsProps {
  items: FeaturedItem[];
  menuLink: string;
}

export function PopularItems({ items, menuLink }: PopularItemsProps) {
  const formatPrice = useFormatPrice();

  if (items.length === 0) return null;

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-10 uppercase tracking-wide">
          What&apos;s Hot
        </h2>

        {/* Horizontal Scrollable Strip */}
        <div
          className="flex overflow-x-auto gap-6 snap-x snap-mandatory pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="flex-shrink-0 snap-center text-center w-40"
            >
              {/* Circular Image */}
              <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden mb-3">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <ImagePlaceholderIcon className="w-10 h-10 text-gray-300" />
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">
                {item.name}
              </h3>
              <p className="text-theme-primary font-bold text-sm">
                {formatPrice(item.price)}
              </p>
            </div>
          ))}
        </div>

        {/* View Full Menu */}
        <div className="text-center mt-8">
          <a
            href={menuLink}
            className="inline-flex items-center gap-2 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-foreground font-bold px-6 py-3 rounded-full transition-colors"
          >
            View Full Menu
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
