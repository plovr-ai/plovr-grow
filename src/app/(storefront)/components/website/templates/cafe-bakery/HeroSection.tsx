import Image from "next/image";

interface HeroSectionProps {
  name: string;
  tagline: string;
  heroImage: string;
}

export function HeroSection({ name, tagline, heroImage }: HeroSectionProps) {
  return (
    <section className="relative min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="relative w-full max-w-6xl mx-auto rounded-3xl overflow-hidden min-h-[60vh] flex items-center justify-center">
        {/* Background */}
        {heroImage ? (
          <>
            <Image
              src={heroImage}
              alt={name}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-amber-900/40" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-amber-800 to-amber-900" />
        )}

        {/* Content */}
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="font-serif italic text-4xl md:text-6xl mb-4">
            {name}
          </h1>
          {tagline && (
            <p className="text-lg md:text-xl font-light tracking-wide max-w-2xl mx-auto opacity-90">
              {tagline}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
