"use client";

import { useFormatPhone } from "@/hooks";
import type { MerchantInfo } from "@/types/website";

interface FooterSectionProps {
  merchant: MerchantInfo;
}

export function FooterSection({ merchant }: FooterSectionProps) {
  const formatPhone = useFormatPhone();

  const parts = [merchant.name];

  const address = [merchant.address, merchant.city, merchant.state, merchant.zipCode]
    .filter(Boolean)
    .join(", ");
  if (address) parts.push(address);

  if (merchant.phone) parts.push(formatPhone(merchant.phone));

  return (
    <footer className="bg-theme-primary py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-theme-primary-foreground text-sm">
          {parts.join(" \u00B7 ")}
        </p>
        <p className="text-theme-primary-foreground/60 text-xs mt-2">
          &copy; {new Date().getFullYear()} {merchant.name}. All rights
          reserved. Powered by Plovr
        </p>
      </div>
    </footer>
  );
}
