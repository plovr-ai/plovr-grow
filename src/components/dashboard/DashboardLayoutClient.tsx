"use client";

import { DashboardProvider, type DashboardContextValue } from "@/contexts";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  dashboardContext: DashboardContextValue;
}

export function DashboardLayoutClient({
  children,
  dashboardContext,
}: DashboardLayoutClientProps) {
  return (
    <DashboardProvider value={dashboardContext}>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Right Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Header */}
          <Header />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </DashboardProvider>
  );
}
