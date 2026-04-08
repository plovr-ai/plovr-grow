"use client";

import { useState } from "react";
import { ClaimModal } from "./ClaimModal";

interface TrialBannerProps {
  tenantId: string;
}

export function TrialBanner({ tenantId }: TrialBannerProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-40 bg-theme-primary text-theme-primary-foreground py-2 px-4 text-center text-sm">
        <span>This is a preview of your restaurant website</span>
        <button onClick={() => setShowModal(true)}
          className="ml-3 inline-block bg-white text-theme-primary font-semibold px-4 py-1 rounded-md text-sm hover:bg-gray-100 transition-colors">
          Claim This Website
        </button>
      </div>

      <ClaimModal tenantId={tenantId} isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
