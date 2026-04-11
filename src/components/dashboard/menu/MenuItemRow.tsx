"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useDashboardFormatPrice } from "@/hooks";
import { cn } from "@/lib/utils";

export interface MenuItemRowData {
  id: string;
  name: string;
  imageUrl: string | null;
  price: number;
}

export interface MenuItemRowProps {
  item: MenuItemRowData;
  subtitle?: React.ReactNode;
  metadata?: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  imageSize?: "sm" | "md";
  isHighlighted?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function MenuItemRow({
  item,
  subtitle,
  metadata,
  leftSlot,
  rightSlot,
  imageSize = "md",
  isHighlighted = false,
  onClick,
  disabled = false,
  className,
}: MenuItemRowProps) {
  const formatPrice = useDashboardFormatPrice();

  const imageSizeClasses = {
    sm: "h-10 w-10",
    md: "h-12 w-12",
  };

  const gapClasses = {
    sm: "gap-3",
    md: "gap-4",
  };

  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center rounded-lg border bg-white p-3 text-left",
        isHighlighted
          ? "border-theme-primary bg-theme-primary-light"
          : "hover:bg-gray-50",
        onClick && !disabled && "transition-colors",
        disabled && "cursor-not-allowed opacity-50",
        gapClasses[imageSize],
        className
      )}
    >
      {leftSlot}

      {/* Image */}
      <div
        className={cn(
          "relative flex-shrink-0 overflow-hidden rounded-md bg-gray-100",
          imageSizeClasses[imageSize]
        )}
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {imageSize === "sm" ? (
              <ImageIcon className="h-4 w-4 text-gray-300" />
            ) : (
              <span className="text-xs text-gray-300">No img</span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-medium text-gray-900",
            imageSize === "sm" ? "text-sm" : "text-base"
          )}
        >
          {item.name}
        </p>
        {subtitle && (
          <div
            className={cn(
              "text-gray-500",
              imageSize === "sm" ? "text-xs" : "text-sm"
            )}
          >
            {subtitle}
          </div>
        )}
        {metadata}
      </div>

      {/* Right content */}
      {rightSlot || (
        <span className="flex-shrink-0 font-medium text-gray-900">
          {formatPrice(item.price)}
        </span>
      )}
    </Component>
  );
}
