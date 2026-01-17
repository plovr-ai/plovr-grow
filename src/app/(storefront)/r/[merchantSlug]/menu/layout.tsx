import type { Metadata } from "next";
import { getMockMenuPageData } from "@/data/mock/menu";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ merchantSlug: string }>;
}

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { merchantSlug } = await params;
  const data = getMockMenuPageData(merchantSlug);

  return {
    title: `Menu | ${data.merchantName}`,
    description: `Order online from ${data.merchantName}`,
  };
}

export default function MenuLayout({ children }: LayoutProps) {
  return <div className="min-h-screen bg-gray-50">{children}</div>;
}
