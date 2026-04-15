import type { ReactNode } from "react";

interface PlaygroundLayoutProps {
  menuPanel: ReactNode;
  phoneSimulator: ReactNode;
}

export function PlaygroundLayout({
  menuPanel,
  phoneSimulator,
}: PlaygroundLayoutProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          AI Voice Ordering Playground
        </h1>
        <p className="mt-2 text-gray-500">
          Try our AI voice agent — browse the menu and start a call to order by voice.
        </p>
      </div>
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Menu panel — scrollable on desktop */}
        <div className="order-2 lg:order-1 lg:w-1/2">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50/50 p-6">
            {menuPanel}
          </div>
        </div>
        {/* Phone simulator — centered */}
        <div className="order-1 lg:order-2 lg:w-1/2">
          <div className="sticky top-24">
            {phoneSimulator}
          </div>
        </div>
      </div>
    </div>
  );
}
