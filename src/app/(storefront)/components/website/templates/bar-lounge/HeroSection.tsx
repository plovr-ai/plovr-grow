interface HeroSectionProps {
  name: string;
  tagline: string;
  heroImage: string;
}

export function HeroSection({ name, tagline, heroImage }: HeroSectionProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center">
      {/* Background */}
      {heroImage ? (
        <>
          <img
            src={heroImage}
            alt={name}
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/70" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gray-950" />
      )}

      {/* Content */}
      <div className="relative z-10 text-center px-4">
        <h1 className="text-5xl md:text-7xl font-bold text-white drop-shadow-[0_0_15px_hsl(var(--theme-primary))]">
          {name}
        </h1>
        {tagline && (
          <p className="text-xl text-white/70 mt-6 max-w-2xl mx-auto">
            {tagline}
          </p>
        )}
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-950 to-transparent" />
    </section>
  );
}
