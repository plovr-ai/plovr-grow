import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, Header } from "@/components/dashboard";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Note: Middleware handles redirect, but this is a fallback
  if (!session) {
    redirect("/dashboard/login");
  }

  return (
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
  );
}
