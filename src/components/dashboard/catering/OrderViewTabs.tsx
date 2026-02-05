"use client";

import { Calendar, List } from "lucide-react";

interface OrderViewTabsProps {
  activeView: "calendar" | "list";
  onViewChange: (view: "calendar" | "list") => void;
}

export function OrderViewTabs({ activeView, onViewChange }: OrderViewTabsProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
      <button
        onClick={() => onViewChange("calendar")}
        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          activeView === "calendar"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        <Calendar className="h-4 w-4" />
        Calendar
      </button>
      <button
        onClick={() => onViewChange("list")}
        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          activeView === "list"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        <List className="h-4 w-4" />
        List
      </button>
    </div>
  );
}
