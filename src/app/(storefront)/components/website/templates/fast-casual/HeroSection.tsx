import Link from "next/link";
import type { MerchantInfo } from "@/types/website";

interface HeroSectionProps {
  merchant: MerchantInfo;
  menuLink: string;
}

export function HeroSection({ merchant, menuLink }: HeroSectionProps) {
  return (
    <section className="bg-theme-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Left: Text + CTA */}
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-theme-primary-foreground mb-4 tracking-tight">
              {merchant.name}
            </h1>
            {merchant.tagline && (
              <p className="text-xl text-theme-primary-foreground/80 mb-8">
                {merchant.tagline}
              </p>
            )}
            <Link
              href={menuLink}
              className="inline-block bg-white text-theme-primary font-bold text-lg px-8 py-4 rounded-full hover:bg-gray-100 transition-colors shadow-lg"
            >
              Order Now
            </Link>
          </div>

          {/* Right: Hero Image */}
          {merchant.heroImage && (
            <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden">
              <img
                src={merchant.heroImage}
                alt={merchant.name}
                loading="eager"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
