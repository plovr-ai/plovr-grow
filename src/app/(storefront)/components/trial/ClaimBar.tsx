"use client";

import { useState, useEffect } from "react";
import { ClaimModal } from "./ClaimModal";

const DISMISS_KEY = "plovr-claim-bar-dismissed";

interface ClaimBarProps {
  tenantId: string;
  companySlug: string;
}

export function ClaimBar({ tenantId, companySlug }: ClaimBarProps) {
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-theme-primary text-theme-primary-foreground py-3 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <p className="text-sm sm:text-base font-medium">
            <span className="hidden sm:inline">This is your restaurant? Claim your free website now!</span>
            <span className="sm:hidden">Claim your free website!</span>
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowModal(true)}
              className="bg-white text-theme-primary font-semibold px-4 py-1.5 rounded-md text-sm hover:bg-gray-100 transition-colors"
            >
              Claim Now &rarr;
            </button>
            <button
              onClick={handleDismiss}
              className="text-theme-primary-foreground/70 hover:text-theme-primary-foreground p-1"
              aria-label="Dismiss"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <ClaimModal tenantId={tenantId} companySlug={companySlug} isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
