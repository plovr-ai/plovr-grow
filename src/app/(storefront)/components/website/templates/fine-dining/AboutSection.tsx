interface AboutSectionProps {
  tagline: string;
}

export function AboutSection({ tagline }: AboutSectionProps) {
  if (!tagline) return null;

  return (
    <section className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-12 md:gap-16">
          {/* Left label */}
          <div className="md:w-1/4 flex-shrink-0">
            <p className="text-sm tracking-[0.3em] uppercase text-theme-primary md:[writing-mode:vertical-lr] md:rotate-180">
              Our Story
            </p>
          </div>

          {/* Right content */}
          <div className="md:w-3/4">
            <p className="text-lg font-serif leading-relaxed text-gray-700">
              {tagline}
            </p>
          </div>
        </div>

        <div className="border-b border-gray-200 mt-16" />
      </div>
    </section>
  );
}
