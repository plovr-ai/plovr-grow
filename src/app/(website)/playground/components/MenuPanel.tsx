import { formatPrice } from "@/lib/utils";
import type { MenuCategoryWithItems } from "@/services/menu/menu.types";

interface MenuPanelProps {
  categories: MenuCategoryWithItems[];
  currency?: string;
  merchantName?: string | null;
}

export function MenuPanel({
  categories,
  currency = "USD",
  merchantName,
}: MenuPanelProps) {
  if (categories.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <p>No menu items available</p>
      </div>
    );
  }

  const heading = merchantName ? `${merchantName}'s Menu` : "Menu";

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-gray-900">{heading}</h2>
      {categories.map((category) => (
        <section key={category.id}>
          <h3 className="mb-3 text-lg font-semibold text-gray-900">
            {category.name}
          </h3>
          {category.description && (
            <p className="mb-3 text-sm text-gray-500">{category.description}</p>
          )}
          <div className="space-y-2">
            {category.menuItems.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3"
              >
                {item.imageUrl && (
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {item.name}
                    </h4>
                    <span className="whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatPrice(Number(item.price), currency)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
