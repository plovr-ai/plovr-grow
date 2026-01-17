export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: 添加商户认证逻辑
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <h1 className="text-xl font-semibold">Merchant Dashboard</h1>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
