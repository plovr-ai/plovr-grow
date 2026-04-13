interface StorySectionProps {
  tagline: string;
}

export function StorySection({ tagline }: StorySectionProps) {
  if (!tagline) return null;

  return (
    <section className="py-20 bg-stone-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="text-xs tracking-[0.3em] uppercase text-theme-primary">
          OUR STORY
        </span>
        <p className="font-serif text-xl md:text-2xl leading-relaxed max-w-2xl mx-auto mt-6 text-stone-700">
          {tagline}
        </p>
      </div>
    </section>
  );
}
