"use client";

import { useFormatPhone } from "@/hooks";
import type { MerchantInfo, BusinessHoursMap } from "@/types/website";

interface QuickInfoProps {
  merchant: MerchantInfo;
}

function getTodayHours(businessHours: BusinessHoursMap): string | null {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const today = days[new Date().getDay()];
  const todayHours = businessHours[today];

  if (!todayHours) return null;
  if (todayHours.closed) return "Closed today";

  return `${todayHours.open} - ${todayHours.close}`;
}

export function QuickInfo({ merchant }: QuickInfoProps) {
  const formatPhone = useFormatPhone();

  const fullAddress = [merchant.address, merchant.city, merchant.state, merchant.zipCode]
    .filter(Boolean)
    .join(", ");
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  const todayHours = getTodayHours(merchant.businessHours);
  const hasContactInfo = Boolean(merchant.phone || merchant.email);

  return (
    <section className="py-12 md:py-16 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Location Card */}
          {merchant.address && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="text-3xl mb-3" aria-hidden="true">
                <svg className="w-8 h-8 mx-auto text-theme-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Location</h3>
              <p className="text-gray-600 text-sm mb-3">{fullAddress}</p>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-theme-primary hover:text-theme-primary-hover font-semibold text-sm transition-colors"
              >
                Get Directions
              </a>
            </div>
          )}

          {/* Hours Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <div className="text-3xl mb-3" aria-hidden="true">
              <svg className="w-8 h-8 mx-auto text-theme-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Hours</h3>
            {todayHours ? (
              <p className="text-gray-600 text-sm">
                Today: <span className="font-semibold">{todayHours}</span>
              </p>
            ) : (
              <p className="text-gray-400 text-sm">Hours not available</p>
            )}
          </div>

          {/* Contact Card */}
          {hasContactInfo && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="text-3xl mb-3" aria-hidden="true">
                <svg className="w-8 h-8 mx-auto text-theme-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Contact</h3>
              <div className="space-y-1 text-sm text-gray-600">
                {merchant.phone && (
                  <p>
                    <a
                      href={`tel:${merchant.phone}`}
                      className="hover:text-theme-primary transition-colors"
                    >
                      {formatPhone(merchant.phone)}
                    </a>
                  </p>
                )}
                {merchant.email && (
                  <p>
                    <a
                      href={`mailto:${merchant.email}`}
                      className="hover:text-theme-primary transition-colors"
                    >
                      {merchant.email}
                    </a>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
