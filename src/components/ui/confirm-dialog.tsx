"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

type ConfirmDialogVariant = "default" | "destructive";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

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

  // Auto-focus confirm button when dialog opens
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Split message by newlines and render as separate paragraphs
  const renderMessage = () => {
    const lines = message.split("\n");
    return lines.map((line, index) => (
      <p
        key={index}
        className={`text-sm text-gray-600 ${line === "" ? "h-2" : ""}`}
      >
        {line || "\u00A0"}
      </p>
    ));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="relative w-full max-w-md rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2
            id="confirm-dialog-title"
            className="text-lg font-semibold text-gray-900"
          >
            {title}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">{renderMessage()}</div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            className={
              variant === "default"
                ? "bg-theme-primary text-theme-primary-foreground hover:bg-theme-primary-hover"
                : ""
            }
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
