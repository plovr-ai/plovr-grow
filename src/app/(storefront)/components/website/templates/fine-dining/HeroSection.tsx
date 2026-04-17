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
          <div className="absolute inset-0 bg-black/50" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-800" />
      )}

      {/* Content */}
      <div className="relative z-10 text-center text-white px-4">
        <h1 className="text-5xl md:text-7xl font-serif mb-6">{name}</h1>
        {tagline && (
          <p className="text-xl font-light tracking-wide max-w-2xl mx-auto">
            {tagline}
          </p>
        )}
      </div>
    </section>
  );
}
