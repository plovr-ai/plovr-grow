"use client";

import { useState } from "react";
import { ClaimModal } from "./ClaimModal";

interface TrialCheckoutBlockProps {
  tenantId: string;
}

export function TrialCheckoutBlock({ tenantId }: TrialCheckoutBlockProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🍽️</div>
        <h1 className="text-2xl font-bold mb-2">Almost There!</h1>
        <p className="text-gray-600 mb-6">
          Claim this website to start accepting online orders from your customers.
        </p>
        <button onClick={() => setShowModal(true)}
          className="bg-theme-primary text-theme-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-theme-primary-hover transition-colors">
          Claim This Website
        </button>
      </div>

      <ClaimModal tenantId={tenantId} isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
