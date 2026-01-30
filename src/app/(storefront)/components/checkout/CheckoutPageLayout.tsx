"use client";

import { ReactNode } from "react";

interface CheckoutPageLayoutProps {
  children: ReactNode;
  summary: ReactNode;
  mobileFooter: ReactNode;
  mobilePadding?: string;
}

export function CheckoutPageLayout({
  children,
  summary,
  mobileFooter,
  mobilePadding = "pb-40",
}: CheckoutPageLayoutProps) {
  return (
    <>
      <div className="lg:grid lg:grid-cols-3 lg:gap-8">
        {/* Left Column - Form Sections */}
        <div className={`lg:col-span-2 space-y-4 ${mobilePadding} lg:pb-0`}>
          {children}
        </div>

        {/* Right Column - Desktop Sticky Summary */}
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              {summary}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Fixed Footer */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-10">
        {mobileFooter}
      </div>
    </>
  );
}
