"use client";

import { useMerchantConfig } from "@/contexts/MerchantContext";
import type { CustomerReview } from "@/types/website";

interface CustomerReviewsProps {
  reviews: CustomerReview[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-5 h-5 ${star <= rating ? "text-yellow-400" : "text-gray-300"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function SourceIcon({ source }: { source: string }) {
  switch (source) {
    case "google":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      );
    case "yelp":
      return (
        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.16 12.594l-4.995 1.433c-.96.276-1.47-.8-.82-1.544l2.88-3.3c.43-.495.15-1.24-.52-1.34l-4.33-.65c-.67-.1-1.14-.72-.95-1.37l1.62-5.33c.19-.62-.35-1.21-.96-1.04L7.3 1.114c-.61.17-.76.95-.26 1.38l3.33 2.86c.5.43.25 1.24-.42 1.38l-5.26 1.08c-.67.14-.92.97-.43 1.45l3.95 3.9c.5.49.18 1.32-.54 1.42l-5.72.77c-.72.1-1 1.03-.45 1.55l4.26 4.05c.54.51.2 1.42-.58 1.52l-6.16.8c-.78.1-1.07 1.12-.45 1.6l5.05 3.95c.62.48 1.52-.02 1.52-.84V17.67c0-.78.74-1.37 1.5-1.2l5.93 1.35c.76.17 1.38-.63 1.03-1.33l-2.82-5.62c-.35-.7.23-1.5 1-1.37l6.06 1c.77.13 1.3-.76.87-1.45l-3.43-5.55c-.43-.7.12-1.6.93-1.5l6.43.8c.8.1 1.28-.87.75-1.5z"/>
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
  }
}

export function CustomerReviews({ reviews }: CustomerReviewsProps) {
  const { locale } = useMerchantConfig();

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            What Our Customers Say
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Don&apos;t just take our word for it - hear from our happy customers
          </p>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-gray-50 rounded-2xl p-6 md:p-8 flex flex-col h-full"
            >
              {/* Rating */}
              <div className="flex items-center justify-between mb-4">
                <StarRating rating={review.rating} />
                <SourceIcon source={review.source} />
              </div>

              {/* Content */}
              <blockquote className="text-gray-700 mb-6 leading-relaxed flex-1">
                &ldquo;{review.content}&rdquo;
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-3 mt-auto">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-semibold">
                    {review.customerName.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{review.customerName}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(review.date).toLocaleDateString(locale, {
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
