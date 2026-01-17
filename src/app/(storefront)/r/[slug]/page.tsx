import {
  Navigation,
  HeroBanner,
  FeaturedItems,
  CustomerReviews,
  Footer,
} from "@storefront/components/website";
import { getMockWebsiteData } from "@/data/mock/website";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function RestaurantHomePage({ params }: PageProps) {
  const { slug } = await params;
  const data = getMockWebsiteData(slug);

  return (
    <main className="min-h-screen">
      <Navigation
        logo={data.merchant.logo}
        restaurantName={data.merchant.name}
        tenantSlug={slug}
      />
      <HeroBanner merchant={data.merchant} tenantSlug={slug} />
      <FeaturedItems items={data.featuredItems} />
      <CustomerReviews reviews={data.reviews} />
      <Footer merchant={data.merchant} tenantSlug={slug} />
    </main>
  );
}
