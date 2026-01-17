import { Navigation, Footer } from "@storefront/components/website";
import { LocationList } from "@storefront/components/locations";
import { getMockWebsiteData, getMockLocations } from "@/data/mock/website";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LocationsPage({ params }: PageProps) {
  const { slug } = await params;
  const data = getMockWebsiteData(slug);
  const { currentMerchantId, locations } = getMockLocations(slug);

  return (
    <main className="min-h-screen">
      <Navigation
        logo={data.merchant.logo}
        restaurantName={data.merchant.name}
        tenantSlug={slug}
      />

      <div className="pt-20 md:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Our Locations
            </h1>
            <p className="mt-2 text-gray-600">
              Find a {data.merchant.name} near you
            </p>
          </div>

          <LocationList
            locations={locations}
            currentMerchantId={currentMerchantId}
          />
        </div>
      </div>

      <Footer merchant={data.merchant} tenantSlug={slug} />
    </main>
  );
}
