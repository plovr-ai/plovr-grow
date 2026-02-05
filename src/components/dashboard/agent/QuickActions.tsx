"use client";

import { Button } from "@/components/ui/button";
import type { QuickAction } from "@/services/dashboard-agent";

interface QuickActionsProps {
  actions: QuickAction[];
  onActionClick: (action: QuickAction) => void;
  disabled?: boolean;
}

/**
 * Quick Actions Component
 *
 * Displays suggested actions as clickable buttons.
 */
export function QuickActions({
  actions,
  onActionClick,
  disabled = false,
}: QuickActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-gray-100 px-4 py-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            onClick={() => onActionClick(action)}
            disabled={disabled}
            className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
