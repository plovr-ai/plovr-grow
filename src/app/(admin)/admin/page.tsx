import Link from "next/link";

export default function AdminPage() {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Admin Dashboard</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="text-lg font-semibold">Tenants</h3>
          <p className="text-gray-600">Manage SaaS tenants</p>
          <Link
            href="/admin/tenants"
            className="mt-2 inline-block text-indigo-600 hover:text-indigo-800"
          >
            View All &rarr;
          </Link>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="text-lg font-semibold">Merchants</h3>
          <p className="text-gray-600">Manage merchant accounts</p>
          <Link
            href="/admin/merchants"
            className="mt-2 inline-block text-indigo-600 hover:text-indigo-800"
          >
            View All &rarr;
          </Link>
        </div>
      </div>
      {/* TODO: 统计数据 */}
    </div>
  );
}
