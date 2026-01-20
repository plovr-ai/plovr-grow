"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MenuInfo } from "@/services/menu/menu.types";

interface MenuTabsProps {
  menus: MenuInfo[];
  selectedMenuId: string;
  onSelectMenu: (menuId: string) => void;
  onAddMenu: () => void;
  onEditMenu: (menu: MenuInfo) => void;
}

export function MenuTabs({
  menus,
  selectedMenuId,
  onSelectMenu,
  onAddMenu,
  onEditMenu,
}: MenuTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-200">
      <div className="flex gap-1">
        {menus.map((menu) => (
          <button
            key={menu.id}
            onClick={() => onSelectMenu(menu.id)}
            onDoubleClick={() => onEditMenu(menu)}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-md border-b-2 ${
              selectedMenuId === menu.id
                ? "border-primary bg-white text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
            title="Double-click to edit"
          >
            {menu.name}
            {menu.status === "inactive" && (
              <span className="ml-1.5 text-xs text-gray-400">(hidden)</span>
            )}
          </button>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={onAddMenu} className="ml-2">
        <Plus className="h-4 w-4" />
        <span className="sr-only">Add Menu</span>
      </Button>
    </div>
  );
}
