import { merchantService } from "@/services/merchant";
import { notFound } from "next/navigation";
import { CateringPageClient } from "@storefront/components/catering/CateringPageClient";

interface CateringPageProps {
  params: Promise<{
    merchantSlug: string;
  }>;
}

export default async function CateringPage({ params }: CateringPageProps) {
  const { merchantSlug } = await params;

  // Get merchant data
  const merchant = await merchantService.getMerchantBySlug(merchantSlug);
  if (!merchant) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Catering Services
          </h1>
          <p className="mt-2 text-gray-600">
            Planning an event? Let {merchant.name} cater your next gathering!
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <CateringPageClient merchantSlug={merchantSlug} />
      </div>
    </div>
  );
}
