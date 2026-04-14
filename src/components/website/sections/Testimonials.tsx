interface Testimonial {
  quote: string;
  author: string;
}

interface TestimonialsProps {
  title?: string;
  items: Testimonial[];
}

function StarIcon() {
  return (
    <svg
      className="size-5 text-[#ffbf00]"
      viewBox="0 0 20 19"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 0l3.09 6.26L20 7.27l-5 4.87 1.18 6.88L10 15.77l-6.18 3.25L5 12.14 0 7.27l6.91-1.01L10 0z" />
    </svg>
  );
}

export function Testimonials({
  title = "Voice of the Floor",
  items,
}: TestimonialsProps) {
  return (
    <section className="bg-ws-bg-page px-6 py-24 md:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Heading */}
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-center text-3xl font-extrabold tracking-tight text-ws-text-heading md:text-5xl">
            {title}
          </h2>
          <div className="h-1 w-20 rounded-full bg-[#ffbf00]" />
        </div>

        {/* Cards */}
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {items.map((t, i) => (
            <div
              key={i}
              className="flex flex-col rounded-[32px] bg-ws-bg-card p-8"
            >
              {/* Stars */}
              <div className="mb-6 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <StarIcon key={j} />
                ))}
              </div>

              {/* Quote */}
              <p className="mb-auto text-lg font-medium leading-relaxed text-ws-text-heading">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <p className="mt-6 text-sm font-bold text-ws-text-heading">
                {t.author}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
