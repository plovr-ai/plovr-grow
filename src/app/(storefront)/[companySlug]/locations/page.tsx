import { notFound } from "next/navigation";
import { Navigation, Footer } from "@storefront/components/website";
import { LocationList } from "@storefront/components/locations";
import { getMockWebsiteData } from "@/data/mock/website";
import { merchantService } from "@/services/merchant";

interface PageProps {
  params: Promise<{ companySlug: string }>;
}

export default async function LocationsPage({ params }: PageProps) {
  const { companySlug } = await params;
  const company = await merchantService.getCompanyBySlug(companySlug);

  if (!company) {
    notFound();
  }

  // Get website display data (mock for now)
  const data = getMockWebsiteData(companySlug);

  // Convert company merchants to location format
  const locations = company.merchants.map((merchant) => ({
    id: merchant.id,
    slug: merchant.slug,
    name: merchant.name,
    address: merchant.address ?? null,
    city: merchant.city ?? null,
    state: merchant.state ?? null,
    status: "active" as const,
  }));

  return (
    <main className="min-h-screen bg-white">
      <Navigation
        logo={data.merchant.logo}
        restaurantName={company.name}
        companySlug={companySlug}
        menuLink={`/${companySlug}/locations`}
      />

      <div className="pt-20 md:pt-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Our Locations
            </h1>
            <p className="mt-2 text-gray-600">
              Find a {company.name} near you
            </p>
          </div>

          <LocationList locations={locations} currentMerchantId="" />
        </div>
      </div>

      <Footer
        merchant={data.merchant}
        companySlug={companySlug}
        menuLink={`/${companySlug}/locations`}
      />
    </main>
  );
}
