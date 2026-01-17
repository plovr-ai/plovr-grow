import { menuService } from "@/services/menu";
import { MenuPageClient } from "@/components/menu";
import { convertToMenuDisplayData } from "./utils";

interface MenuPageProps {
  params: Promise<{ slug: string }>;
}

export default async function MenuPage({ params }: MenuPageProps) {
  const { slug } = await params;
  const response = await menuService.getMenu(slug);
  const data = convertToMenuDisplayData(response);

  return <MenuPageClient data={data} tenantSlug={slug} />;
}
