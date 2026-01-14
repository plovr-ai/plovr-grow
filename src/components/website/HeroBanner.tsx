import type { MerchantInfo } from "@/types/website";

interface HeroBannerProps {
  merchant: MerchantInfo;
}

export function HeroBanner({ merchant }: HeroBannerProps) {
  const fullAddress = `${merchant.address}, ${merchant.city}, ${merchant.state} ${merchant.zipCode}`;

  return (
    <section className="relative h-screen min-h-[600px] max-h-[900px] flex items-center justify-center">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${merchant.heroImage})` }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center text-white px-4 max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-4 tracking-tight">
          {merchant.name}
        </h1>

        {merchant.tagline && (
          <p className="text-lg md:text-xl lg:text-2xl mb-6 text-white/90">
            {merchant.tagline}
          </p>
        )}

        <div className="flex items-center justify-center gap-2 mb-8 text-white/80">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="text-base md:text-lg">{fullAddress}</span>
        </div>

        <a
          href="#order"
          className="inline-block bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full font-semibold text-lg md:text-xl transition-all hover:scale-105 shadow-lg"
        >
          Order Online
        </a>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
}
