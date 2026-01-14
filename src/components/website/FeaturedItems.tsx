import type { FeaturedItem } from "@/types/website";

interface FeaturedItemsProps {
  items: FeaturedItem[];
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export function FeaturedItems({ items }: FeaturedItemsProps) {
  return (
    <section id="menu" className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Featured Items
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Discover our most popular dishes, crafted with the finest ingredients
          </p>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow group"
            >
              {/* Image */}
              <div className="relative h-48 md:h-56 overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {item.category && (
                  <span className="absolute top-3 left-3 bg-white/90 text-gray-700 text-xs font-medium px-3 py-1 rounded-full">
                    {item.category}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="font-semibold text-lg text-gray-900 mb-2">
                  {item.name}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {item.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">
                    {formatPrice(item.price)}
                  </span>
                  <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors">
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View Full Menu Link */}
        <div className="text-center mt-12">
          <a
            href="#menu-full"
            className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 font-semibold text-lg transition-colors"
          >
            View Full Menu
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
