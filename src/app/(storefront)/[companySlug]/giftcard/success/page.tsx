import { notFound } from "next/navigation";
import { orderService } from "@/services/order";
import { merchantService } from "@/services/merchant";
import { loyaltyConfigService } from "@/services/loyalty";
import { MerchantProvider } from "@/contexts";
import { GiftcardSuccessClient } from "@storefront/components/giftcard";
import { Navigation, Footer } from "@storefront/components/website";

export default async function GiftcardSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ companySlug: string }>;
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { companySlug } = await params;
  const { orderId } = await searchParams;

  if (!orderId) {
    notFound();
  }

  // Get company data for tenantId
  const company = await merchantService.getCompanyBySlug(companySlug);
  if (!company) {
    notFound();
  }

  // Get order details
  const order = await orderService.getOrder(company.tenantId, orderId);
  if (!order || order.salesChannel !== "giftcard") {
    notFound();
  }

  // Get website data for Navigation/Footer
  const websiteData = await merchantService.getCompanyWebsiteData(companySlug);
  if (!websiteData) notFound();

  // Check if loyalty is enabled
  const isLoyaltyEnabled = await loyaltyConfigService.isLoyaltyEnabled(
    company.tenantId,
    company.id
  );

  // Get currency/locale from first merchant or use defaults
  const firstMerchant = company.merchants[0];
  const currency = firstMerchant?.currency ?? "USD";
  const locale = firstMerchant?.locale ?? "en-US";
  const timezone = firstMerchant?.timezone ?? "America/New_York";

  // Build navigation links (handle single vs multi-merchant)
  const hasSingleMerchant = company.merchants.length === 1;
  const menuLink = hasSingleMerchant
    ? `/r/${company.merchants[0].slug}/menu`
    : `/${companySlug}/locations`;
  const cateringLink = hasSingleMerchant
    ? `/r/${company.merchants[0].slug}/catering`
    : `/${companySlug}/locations`;

  return (
    <MerchantProvider config={{
      name: company.name,
      logoUrl: company.logoUrl ?? null,
      currency,
      locale,
      timezone,
      companySlug,
    }}>
      <main className="min-h-screen">
        <Navigation
          logo={websiteData.logo}
          restaurantName={company.name}
          companySlug={companySlug}
          menuLink={menuLink}
          cateringLink={cateringLink}
          isLoyaltyEnabled={isLoyaltyEnabled}
        />

        <section className="pt-20">
          <div className="max-w-2xl mx-auto px-4 py-16">
            <GiftcardSuccessClient
              order={{
                id: order.id,
                orderNumber: order.orderNumber,
                totalAmount: Number(order.totalAmount),
                customerFirstName: order.customerFirstName,
                customerLastName: order.customerLastName,
                customerPhone: order.customerPhone,
                customerEmail: order.customerEmail,
              }}
              companySlug={companySlug}
            />
          </div>
        </section>

        <Footer
          merchant={websiteData}
          companySlug={companySlug}
          menuLink={menuLink}
        />
      </main>
    </MerchantProvider>
  );
}
