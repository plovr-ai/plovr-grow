import type { MenuCategoryWithItemsViewModel } from "@/types/menu-page";
import { MenuItemCard } from "./MenuItemCard";

interface MenuCategorySectionProps {
  data: MenuCategoryWithItemsViewModel;
  onAddItem: (itemId: string) => void;
}

export function MenuCategorySection({
  data,
  onAddItem,
}: MenuCategorySectionProps) {
  const { category, items } = data;

  return (
    <section id={`category-${category.id}`} className="scroll-mt-32">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
        {category.description && (
          <p className="text-gray-500 text-sm mt-1">{category.description}</p>
        )}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <MenuItemCard key={item.id} item={item} onAddClick={onAddItem} />
        ))}
      </div>
    </section>
  );
}
