import type { Metadata } from "next";
import { getMockMenuPageData } from "@/data/mock/menu";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const data = getMockMenuPageData(slug);

  return {
    title: `Menu | ${data.merchantName}`,
    description: `Order online from ${data.merchantName}`,
  };
}

export default function MenuLayout({ children }: LayoutProps) {
  return <div className="min-h-screen bg-gray-50">{children}</div>;
}
