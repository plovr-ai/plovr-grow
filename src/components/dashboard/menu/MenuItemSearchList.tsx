"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MenuItemSearchListProps<T> {
  items: T[];
  filterFn: (item: T, query: string) => boolean;
  renderItem: (item: T) => React.ReactNode;
  getItemKey: (item: T) => string;
  isLoading?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptySearchMessage?: string;
  maxHeight?: string;
  className?: string;
  listClassName?: string;
}

export function MenuItemSearchList<T>({
  items,
  filterFn,
  renderItem,
  getItemKey,
  isLoading = false,
  searchPlaceholder = "Search items...",
  emptyMessage = "No items available",
  emptySearchMessage = "No items match your search",
  maxHeight = "max-h-[500px]",
  className,
  listClassName,
}: MenuItemSearchListProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = items.filter((item) => filterFn(item, searchQuery));

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-gray-500">{emptySearchMessage}</p>
        </div>
      ) : (
        <div className={cn("space-y-2 overflow-y-auto", maxHeight, listClassName)}>
          {filteredItems.map((item) => (
            <div key={getItemKey(item)}>{renderItem(item)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
