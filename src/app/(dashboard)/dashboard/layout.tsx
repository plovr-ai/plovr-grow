import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Plovr",
  description: "Manage your restaurant business",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This is a shared layout for all dashboard routes
  // Authentication is handled by:
  // - Middleware (for route protection)
  // - (protected)/layout.tsx (for authenticated UI like header)
  return <>{children}</>;
}
