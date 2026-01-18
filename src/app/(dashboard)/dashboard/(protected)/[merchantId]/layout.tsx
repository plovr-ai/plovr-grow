interface MerchantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ merchantId: string }>;
}

export default async function MerchantLayout({
  children,
}: MerchantLayoutProps) {
  return <>{children}</>;
}
