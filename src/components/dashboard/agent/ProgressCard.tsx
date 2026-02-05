"use client";

import type { ProgressContent } from "@/services/dashboard-agent";

interface ProgressCardProps {
  progress: ProgressContent;
}

/**
 * Progress Card Component
 *
 * Displays progress for long-running operations.
 */
export function ProgressCard({ progress }: ProgressCardProps) {
  return (
    <div className="w-full rounded-lg border bg-white p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{progress.stage}</span>
        <span className="text-gray-500">{progress.progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
          style={{ width: `${progress.progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-500">{progress.message}</p>
    </div>
  );
}
