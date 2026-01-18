import { auth, signOut } from "@/lib/auth";
import { LogOut, User } from "lucide-react";

export async function Header() {
  const session = await auth();

  if (!session) {
    return null;
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-4">
        {/* Page title can be added here if needed */}
      </div>

      <div className="flex items-center gap-4">
        {/* User info */}
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-gray-500" />
          <span className="text-gray-700">{session.user.name}</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-500">{session.user.role}</span>
        </div>

        {/* Sign out button */}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/dashboard/login" });
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
