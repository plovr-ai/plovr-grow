interface OrdersManagementProps {
  params: Promise<{ merchantId: string }>;
}

export default async function OrdersManagementPage({
  params,
}: OrdersManagementProps) {
  const { merchantId } = await params;

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Orders Management</h2>
      <p className="text-gray-600">Manage orders for merchant: {merchantId}</p>
      {/* TODO: 订单管理功能 */}
    </div>
  );
}
