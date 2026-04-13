import Image from "next/image";
import type { FeaturedItem } from "@/types/website";

interface SpecialsSectionProps {
  items: FeaturedItem[];
  currency: string;
  locale: string;
}

function formatPrice(price: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(price);
}

export function SpecialsSection({
  items,
  currency,
  locale,
}: SpecialsSectionProps) {
  if (items.length === 0) return null;

  const displayItems = items.slice(0, 4);

  return (
    <section className="py-20 bg-amber-50/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-serif text-3xl md:text-4xl text-center text-stone-800 mb-16">
          Our Favorites
        </h2>

        <div className="space-y-16">
          {displayItems.map((item, index) => (
            <div
              key={item.id}
              className={`flex flex-col md:flex-row ${
                index % 2 === 1 ? "md:flex-row-reverse" : ""
              } gap-8 items-center`}
            >
              {/* Image */}
              {item.image && (
                <div className="w-full md:w-1/2 flex-shrink-0">
                  <div className="relative rounded-2xl overflow-hidden aspect-square">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Text */}
              <div className="w-full md:w-1/2 text-center md:text-left">
                <h3 className="font-serif text-2xl text-stone-800 mb-3">
                  {item.name}
                </h3>
                {item.description && (
                  <p className="text-stone-600 leading-relaxed mb-4">
                    {item.description}
                  </p>
                )}
                <span className="text-theme-primary font-medium text-lg">
                  {formatPrice(item.price, currency, locale)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
