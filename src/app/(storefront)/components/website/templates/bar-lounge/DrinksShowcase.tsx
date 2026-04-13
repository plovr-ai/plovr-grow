import Image from "next/image";
import Link from "next/link";
import type { FeaturedItem } from "@/types/website";

interface DrinksShowcaseProps {
  items: FeaturedItem[];
  menuLink: string;
  currency: string;
  locale: string;
}

function formatPrice(price: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(price);
}

export function DrinksShowcase({
  items,
  menuLink,
  currency,
  locale,
}: DrinksShowcaseProps) {
  if (items.length === 0) return null;

  const displayItems = items.slice(0, 6);

  return (
    <section className="py-24 bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-sm tracking-[0.3em] uppercase text-white mb-16">
          Signature Drinks
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayItems.map((item) => (
            <div
              key={item.id}
              className="bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:border-theme-primary/50 transition"
            >
              {item.image && (
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <h3 className="text-white font-medium">{item.name}</h3>
                {item.description && (
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}
                <p className="text-theme-primary font-medium mt-2">
                  {formatPrice(item.price, currency, locale)}
                </p>
              </div>
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
