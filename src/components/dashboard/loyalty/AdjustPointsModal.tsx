"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AdjustmentType = "add" | "deduct";

interface AdjustPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (points: number, description: string) => Promise<void>;
  currentBalance: number;
  memberName: string;
}

export function AdjustPointsModal({
  isOpen,
  onClose,
  onConfirm,
  currentBalance,
  memberName,
}: AdjustPointsModalProps) {
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("add");
  const [pointsAmount, setPointsAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAdjustmentType("add");
      setPointsAmount("");
      setDescription("");
      setError(null);
      // Focus input after modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const parsedPoints = parseInt(pointsAmount, 10) || 0;
  const actualPoints = adjustmentType === "add" ? parsedPoints : -parsedPoints;
  const newBalance = currentBalance + actualPoints;
  const isValid = parsedPoints > 0 && description.trim().length > 0;
  const wouldBeNegative = newBalance < 0;

  const handleSubmit = async () => {
    if (!isValid || wouldBeNegative) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm(actualPoints, description.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust points");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePointsChange = (value: string) => {
    // Only allow positive integers
    const cleaned = value.replace(/\D/g, "");
    setPointsAmount(cleaned);
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="adjust-points-title"
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2
              id="adjust-points-title"
              className="text-lg font-semibold text-gray-900"
            >
              Adjust Points
            </h2>
            <p className="text-sm text-gray-500">{memberName}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-4">
          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Adjustment Type */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Adjustment Type
            </label>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="adjustmentType"
                  value="add"
                  checked={adjustmentType === "add"}
                  onChange={() => setAdjustmentType("add")}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Add Points</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="adjustmentType"
                  value="deduct"
                  checked={adjustmentType === "deduct"}
                  onChange={() => setAdjustmentType("deduct")}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Deduct Points</span>
              </label>
            </div>
          </div>

          {/* Points Amount */}
          <div>
            <label
              htmlFor="points-amount"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Points Amount
            </label>
            <Input
              ref={inputRef}
              id="points-amount"
              type="text"
              inputMode="numeric"
              value={pointsAmount}
              onChange={(e) => handlePointsChange(e.target.value)}
              placeholder="Enter points amount"
              className="w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Reason <span className="text-red-500">*</span>
            </label>
            <Input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Compensation for service issue"
              maxLength={500}
              className="w-full"
            />
          </div>

          {/* Balance Preview */}
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current Balance</span>
              <span className="font-medium">
                {currentBalance.toLocaleString()}
              </span>
            </div>
            {parsedPoints > 0 && (
              <>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-gray-600">Adjustment</span>
                  <span
                    className={`font-medium ${
                      adjustmentType === "add"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {adjustmentType === "add" ? "+" : "-"}
                    {parsedPoints.toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-sm">
                  <span className="font-medium text-gray-900">New Balance</span>
                  <span
                    className={`font-semibold ${
                      wouldBeNegative ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {newBalance.toLocaleString()}
                  </span>
                </div>
                {wouldBeNegative && (
                  <p className="mt-2 text-xs text-red-600">
                    Cannot deduct more points than the current balance
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || wouldBeNegative || isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
