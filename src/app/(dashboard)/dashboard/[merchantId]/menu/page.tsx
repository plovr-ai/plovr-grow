interface MenuManagementProps {
  params: Promise<{ merchantId: string }>;
}

export default async function MenuManagementPage({
  params,
}: MenuManagementProps) {
  const { merchantId } = await params;

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Menu Management</h2>
      <p className="text-gray-600">Manage menu for merchant: {merchantId}</p>
      {/* TODO: 菜单管理功能 */}
    </div>
  );
}
