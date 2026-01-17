interface MerchantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ merchantId: string }>;
}

export default async function MerchantLayout({
  children,
  params,
}: MerchantLayoutProps) {
  const { merchantId } = await params;

  return (
    <div>
      <nav className="mb-6 flex gap-4 border-b pb-4">
        <a
          href={`/dashboard/${merchantId}`}
          className="text-gray-600 hover:text-gray-900"
        >
          Overview
        </a>
        <a
          href={`/dashboard/${merchantId}/menu`}
          className="text-gray-600 hover:text-gray-900"
        >
          Menu
        </a>
        <a
          href={`/dashboard/${merchantId}/orders`}
          className="text-gray-600 hover:text-gray-900"
        >
          Orders
        </a>
        <a
          href={`/dashboard/${merchantId}/settings`}
          className="text-gray-600 hover:text-gray-900"
        >
          Settings
        </a>
      </nav>
      {children}
    </div>
  );
}
