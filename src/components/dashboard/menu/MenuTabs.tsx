"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MenuInfo } from "@/services/menu/menu.types";

interface MenuTabsProps {
  menus: MenuInfo[];
  selectedMenuId: string;
  onSelectMenu: (menuId: string) => void;
  onAddMenu: () => void;
  onEditMenu: (menu: MenuInfo) => void;
  onReorderMenus: (updates: Array<{ id: string; sortOrder: number }>) => void;
}

interface SortableMenuTabProps {
  menu: MenuInfo;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}

function SortableMenuTab({
  menu,
  isSelected,
  onSelect,
  onEdit,
}: SortableMenuTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: menu.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors rounded-t-md border-b-2 ${
        isSelected
          ? "border-primary bg-white text-gray-900"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
      } ${isDragging ? "opacity-50 z-50" : ""}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Tab content */}
      <button
        onClick={onSelect}
        onDoubleClick={onEdit}
        className="whitespace-nowrap"
        title="Double-click to edit"
      >
        {menu.name}
      </button>
    </div>
  );
}

export function MenuTabs({
  menus,
  selectedMenuId,
  onSelectMenu,
  onAddMenu,
  onEditMenu,
  onReorderMenus,
}: MenuTabsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = menus.findIndex((m) => m.id === active.id);
      const newIndex = menus.findIndex((m) => m.id === over.id);

      const newOrder = arrayMove(menus, oldIndex, newIndex);

      // Build sort order updates
      const updates = newOrder.map((menu, index) => ({
        id: menu.id,
        sortOrder: index,
      }));

      onReorderMenus(updates);
    }
  };

  return (
    <div className="flex items-center gap-1 border-b border-gray-200">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={menus.map((m) => m.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex gap-1">
            {menus.map((menu) => (
              <SortableMenuTab
                key={menu.id}
                menu={menu}
                isSelected={selectedMenuId === menu.id}
                onSelect={() => onSelectMenu(menu.id)}
                onEdit={() => onEditMenu(menu)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button variant="ghost" size="sm" onClick={onAddMenu} className="ml-2">
        <Plus className="h-4 w-4" />
        <span className="sr-only">Add Menu</span>
      </Button>
    </div>
  );
}
