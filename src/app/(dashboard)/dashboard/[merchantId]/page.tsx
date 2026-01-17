interface MerchantOverviewProps {
  params: Promise<{ merchantId: string }>;
}

export default async function MerchantOverviewPage({
  params,
}: MerchantOverviewProps) {
  const { merchantId } = await params;

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Merchant Overview</h2>
      <p className="text-gray-600">Merchant ID: {merchantId}</p>
      {/* TODO: 商户概览数据 */}
    </div>
  );
}
