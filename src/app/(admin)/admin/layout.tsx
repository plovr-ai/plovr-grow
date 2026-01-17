export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: 添加内部认证逻辑
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-indigo-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Admin Portal</h1>
            <nav className="flex gap-4">
              <a href="/admin" className="hover:text-indigo-200">
                Home
              </a>
              <a href="/admin/tenants" className="hover:text-indigo-200">
                Tenants
              </a>
              <a href="/admin/merchants" className="hover:text-indigo-200">
                Merchants
              </a>
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
