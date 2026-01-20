"use client";

interface MenuNavProps {
  menus: Array<{ id: string; name: string }>;
  currentMenuId: string;
  onMenuSelect: (menuId: string) => void;
}

export function MenuNav({ menus, currentMenuId, onMenuSelect }: MenuNavProps) {
  // Don't render if only one menu
  if (menus.length <= 1) {
    return null;
  }

  return (
    <div className="sticky top-16 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide">
          {menus.map((menu) => (
            <button
              key={menu.id}
              onClick={() => onMenuSelect(menu.id)}
              className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                currentMenuId === menu.id
                  ? "bg-theme-primary text-theme-primary-foreground"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {menu.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
