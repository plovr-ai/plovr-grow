interface SettingsProps {
  params: Promise<{ merchantId: string }>;
}

export default async function SettingsPage({ params }: SettingsProps) {
  const { merchantId } = await params;

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Settings</h2>
      <p className="text-gray-600">Settings for merchant: {merchantId}</p>
      {/* TODO: 设置功能 */}
    </div>
  );
}
