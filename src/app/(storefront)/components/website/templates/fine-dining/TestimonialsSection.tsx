import type { CustomerReview } from "@/types/website";

interface TestimonialsSectionProps {
  reviews: CustomerReview[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < rating ? "text-theme-primary" : "text-gray-300"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function TestimonialsSection({ reviews }: TestimonialsSectionProps) {
  if (reviews.length === 0) return null;

  const review = reviews[0];

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Decorative quote */}
        <span className="text-8xl text-theme-primary/20 font-serif leading-none select-none">
          &ldquo;
        </span>

        <blockquote className="mt-[-2rem]">
          <p className="text-xl md:text-2xl font-serif italic text-gray-700 leading-relaxed">
            {review.content}
          </p>
        </blockquote>

        <div className="mt-8 flex flex-col items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {review.customerName}
          </span>
          <StarRating rating={review.rating} />
        </div>
      </div>
    </section>
  );
}
