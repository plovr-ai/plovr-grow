import Link from "next/link";
import { notFound } from "next/navigation";
import { orderService } from "@/services/order";
import { merchantService } from "@/services/merchant";

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

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <div className="text-center">
        {/* Success Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-4">Gift Card Purchased!</h1>
        <p className="text-gray-600 mb-2">Thank you for your purchase</p>
        <p className="text-lg font-semibold text-gray-700 mb-8">
          Order #{order.orderNumber}
        </p>

        {/* Order Details */}
        <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
          <h2 className="text-lg font-semibold mb-4">Order Details</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Amount:</span>
              <span className="font-semibold">${Number(order.totalAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Buyer:</span>
              <span className="font-semibold">{order.customerName}</span>
            </div>
            {order.customerEmail && (
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-semibold">{order.customerEmail}</span>
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <p className="text-sm text-blue-800">
            {order.customerEmail
              ? `A confirmation email has been sent to ${order.customerEmail}`
              : "Please save your order number for your records"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={`/${companySlug}/giftcard`}>
            <button className="w-full sm:w-auto px-6 py-3 bg-theme-primary text-theme-primary-foreground rounded-lg font-semibold hover:bg-theme-primary-hover transition-colors">
              Buy Another Gift Card
            </button>
          </Link>
          <Link href={`/${companySlug}`}>
            <button className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors">
              Return to Homepage
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
