"use client";

import {
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { ToolResultContent } from "@/services/dashboard-agent";

interface ToolResultCardProps {
  result: ToolResultContent;
}

/**
 * Tool Result Card Component
 *
 * Displays the result of a tool execution.
 */
export function ToolResultCard({ result }: ToolResultCardProps) {
  // Generic result card
  return (
    <div
      className={`w-full rounded-lg border p-4 ${
        result.success
          ? "border-green-200 bg-green-50"
          : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-start gap-3">
        {result.success ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
        <div className="flex-1">
          <h4
            className={`font-medium ${
              result.success ? "text-green-800" : "text-red-800"
            }`}
          >
            {result.toolName}
          </h4>
          {result.error && (
            <p className="mt-1 text-sm text-red-700">{result.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
