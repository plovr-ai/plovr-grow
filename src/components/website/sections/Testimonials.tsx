interface Testimonial {
  quote: string;
  author: string;
  role?: string;
}

interface TestimonialsProps {
  title: string;
  titleBreak?: string;
  featuredQuote?: string;
  items: Testimonial[];
}

function StarIcon() {
  return (
    <svg
      className="w-5 h-5 text-yellow-400"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function Testimonials({
  title,
  titleBreak,
  featuredQuote,
  items,
}: TestimonialsProps) {
  return (
    <section className="relative bg-white px-6 md:px-16 py-24">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-10 md:gap-16">
        {/* Left Heading */}
        <div className="md:w-96 flex-shrink-0">
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            {title}
            {titleBreak && (
              <>
                <br />
                {titleBreak}
              </>
            )}
          </h2>
          {featuredQuote && (
            <div className="border-l-2 border-yellow-400 pl-6">
              <p className="text-gray-600 leading-relaxed">
                &ldquo;{featuredQuote}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Testimonial Cards */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((t, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm"
            >
              {/* Star Rating */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <StarIcon key={j} />
                ))}
              </div>
              <p className="text-gray-600 mb-4 leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </p>
              <p className="font-bold text-gray-900">{t.author}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
