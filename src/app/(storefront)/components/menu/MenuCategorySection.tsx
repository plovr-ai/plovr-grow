import type { MenuCategoryWithItemsViewModel } from "@/types/menu-page";
import { MenuItemCard } from "./MenuItemCard";
import type { AddClickParams } from "./MenuItemCard";

interface MenuCategorySectionProps {
  data: MenuCategoryWithItemsViewModel;
  onAddItem: (params: AddClickParams) => void;
}

export function MenuCategorySection({
  data,
  onAddItem,
}: MenuCategorySectionProps) {
  const { category, items } = data;

  return (
    <section id={`category-${category.id}`} className="scroll-mt-36 lg:scroll-mt-20">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
        {category.description && (
          <p className="text-gray-500 text-sm mt-1">{category.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {items.map((item) => (
          <MenuItemCard key={item.id} item={item} onAddClick={onAddItem} />
        ))}
      </div>
    </section>
  );
}
