import Image from "next/image";
import Link from "next/link";
import type { FeaturedItem } from "@/types/website";

interface MenuHighlightsProps {
  items: FeaturedItem[];
  menuLink: string;
  currency: string;
  locale: string;
}

function formatPrice(price: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(price / 100);
}

export function MenuHighlights({
  items,
  menuLink,
  currency,
  locale,
}: MenuHighlightsProps) {
  if (items.length === 0) return null;

  const displayItems = items.slice(0, 4);

  return (
    <section className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-sm tracking-[0.3em] uppercase text-gray-500 mb-16">
          Curated Selections
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {displayItems.map((item) => (
            <div key={item.id}>
              {item.image && (
                <div className="relative aspect-[4/3] overflow-hidden mb-4">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-serif text-lg text-gray-900">
                  {item.name}
                </h3>
                <span className="text-gray-600 font-light whitespace-nowrap">
                  {formatPrice(item.price, currency, locale)}
                </span>
              </div>
              {item.description && (
                <p className="text-sm text-gray-500 mt-1">{item.description}</p>
              )}
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <Link
            href={menuLink}
            className="text-sm tracking-[0.2em] uppercase text-theme-primary hover:text-theme-primary-hover transition-colors border-b border-theme-primary pb-1"
          >
            View Full Menu
          </Link>
        </div>
      </div>
    </section>
  );
}
