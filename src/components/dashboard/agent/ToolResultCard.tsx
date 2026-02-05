"use client";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Package,
} from "lucide-react";
import type { ToolResultContent, ImportResult } from "@/services/dashboard-agent";

interface ToolResultCardProps {
  result: ToolResultContent;
}

/**
 * Tool Result Card Component
 *
 * Displays the result of a tool execution.
 */
export function ToolResultCard({ result }: ToolResultCardProps) {
  // Render based on the renderAs hint
  if (result.renderAs === "menu-import-result" && result.success && result.data) {
    return <MenuImportResultCard data={result.data as ImportResult} />;
  }

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

interface MenuImportResultCardProps {
  data: ImportResult;
}

/**
 * Specialized card for menu import results
 */
function MenuImportResultCard({ data }: MenuImportResultCardProps) {
  const { created, sources, warnings, duration } = data;

  return (
    <div className="w-full space-y-3">
      {/* Success banner */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <h4 className="font-medium text-green-800">Import Successful!</h4>
            <p className="mt-1 text-sm text-green-700">
              Completed in {(duration / 1000).toFixed(1)}s
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-white p-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            <span className="text-xl font-bold text-gray-900">
              {created.categories.length}
            </span>
          </div>
          <p className="text-xs text-gray-500">Categories</p>
        </div>
        <div className="rounded-lg border bg-white p-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <Package className="h-4 w-4 text-gray-400" />
            <span className="text-xl font-bold text-gray-900">
              {created.items.length}
            </span>
          </div>
          <p className="text-xs text-gray-500">Menu Items</p>
        </div>
      </div>

      {/* Source results */}
      <div className="rounded-lg border bg-white p-3">
        <h5 className="mb-2 text-xs font-medium uppercase text-gray-500">
          Sources
        </h5>
        <div className="space-y-1">
          {sources.map((source, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                {source.status === "success" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                ) : source.status === "partial" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                )}
                <span className="capitalize text-gray-700">
                  {source.type.replace("_", " ")}
                </span>
              </div>
              <span className="text-gray-500">
                {source.extractedItems
                  ? `${source.extractedItems} items`
                  : source.error || "Failed"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <div>
              <h5 className="text-sm font-medium text-yellow-800">Warnings</h5>
              <ul className="mt-1 space-y-0.5 text-xs text-yellow-700">
                {warnings.slice(0, 3).map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
                {warnings.length > 3 && (
                  <li>...and {warnings.length - 3} more</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
