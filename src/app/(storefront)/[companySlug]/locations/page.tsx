import { notFound } from "next/navigation";
import { Navigation, Footer } from "@storefront/components/website";
import { LocationList } from "@storefront/components/locations";
import { merchantService } from "@/services/merchant";

interface PageProps {
  params: Promise<{ companySlug: string }>;
  searchParams: Promise<{ addItem?: string }>;
}

export default async function LocationsPage({ params, searchParams }: PageProps) {
  const { companySlug } = await params;
  const { addItem } = await searchParams;
  const company = await merchantService.getCompanyBySlug(companySlug);

  if (!company) {
    notFound();
  }

  // Get website display data from database
  const websiteData = await merchantService.getCompanyWebsiteData(companySlug);
  if (!websiteData) {
    notFound();
  }

  // Convert WebsiteMerchantData to the format expected by components
  const merchantInfo = {
    name: websiteData.name,
    tagline: websiteData.tagline,
    address: websiteData.address,
    city: websiteData.city,
    state: websiteData.state,
    zipCode: websiteData.zipCode,
    phone: websiteData.phone,
    email: websiteData.email,
    logo: websiteData.logo,
    heroImage: websiteData.heroImage,
    businessHours: websiteData.businessHours,
    socialLinks: websiteData.socialLinks,
    currency: websiteData.currency,
    locale: websiteData.locale,
  };

  // Convert company merchants to location format
  const locations = company.merchants.map((merchant) => ({
    id: merchant.id,
    slug: merchant.slug,
    name: merchant.name,
    address: merchant.address ?? null,
    city: merchant.city ?? null,
    state: merchant.state ?? null,
    phone: merchant.phone ?? null,
    email: merchant.email ?? null,
    businessHours: merchant.businessHours ?? null,
    status: merchant.status,
  }));

  return (
    <main className="min-h-screen bg-white">
      <Navigation
        logo={merchantInfo.logo}
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

          <LocationList locations={locations} currentMerchantId="" addItem={addItem} />
        </div>
      </div>

      <Footer
        merchant={merchantInfo}
        companySlug={companySlug}
        menuLink={`/${companySlug}/locations`}
      />
    </main>
  );
}
