interface HeroFeature {
  icon: string;
  label: string;
  caption: string;
}

interface HomeHeroProps {
  eyebrow?: string;
  title: string;
  titleAccent?: string;
  description: string;
  pricingLabel?: string;
  pricingValue?: string;
  pricingOriginal?: string;
  pricingBadge?: string;
  features?: HeroFeature[];
  inputPlaceholder?: string;
  primaryCta: { label: string; href: string; external?: boolean };
}

/* Lucide-style icon paths (24x24 viewBox, stroke-based) */
const featureIcons: Record<string, string[]> = {
  mic: [
    "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z",
    "M19 10v2a7 7 0 0 1-14 0v-2",
    "M12 19v3",
  ],
  clock: [
    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
    "M12 6v6l4 2",
  ],
  "phone-forwarded": [
    "M22 8V2l-6 6",
    "M16 2h6",
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z",
  ],
  zap: ["M13 2 3 14h9l-1 8 10-12h-9l1-8z"],
};

function FeatureIcon({ icon }: { icon: string }) {
  const paths = featureIcons[icon] || featureIcons["zap"];
  return (
    <svg
      className="w-5 h-5 text-ws-primary-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

function FeatureItem({ feature }: { feature: HeroFeature }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 bg-ws-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
        <FeatureIcon icon={feature.icon} />
      </div>
      <div className="flex-1 text-left">
        <div className="text-sm font-bold text-ws-text mb-1">
          {feature.label}
        </div>
        <div className="text-xs text-ws-text-muted">{feature.caption}</div>
      </div>
    </div>
  );
}

export function HomeHero({
  eyebrow = "Trusted by 100+ Restaurants",
  title,
  titleAccent,
  description,
  pricingLabel = "Limited Time Free Trial",
  pricingValue = "$0",
  pricingOriginal = "Originally $49/mo",
  pricingBadge = "Free Trial Included",
  features = [],
  inputPlaceholder = "Enter your restaurant name",
  primaryCta,
}: HomeHeroProps) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 md:px-16 pt-16 pb-24 overflow-hidden bg-white">
      <div className="max-w-7xl mx-auto text-center">
        {/* Trust Badge */}
        <div className="mb-10">
          <span className="inline-block px-4 py-1 bg-ws-primary-50 text-ws-primary-700 text-xs font-bold uppercase tracking-wider rounded-full">
            {eyebrow}
          </span>
        </div>

        {/* Main Heading */}
        <h1 className="text-4xl md:text-7xl font-extrabold mb-6 tracking-tight text-gradient-hero">
          <span className="block leading-tight">{title}</span>
          {titleAccent && (
            <span className="block leading-tight">{titleAccent}</span>
          )}
        </h1>

        <p className="text-lg md:text-xl text-gray-700 mb-12 max-w-2xl mx-auto leading-relaxed font-light text-center">
          {description}
        </p>

        {/* Promotional Card */}
        <div className="mb-12 mx-auto" style={{ maxWidth: 896 }}>
          <div className="bg-white border border-ws-border rounded-lg shadow-lg px-6 md:px-10 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left Column - Pricing */}
            <div className="flex flex-col items-center justify-center">
              <div className="text-xs font-bold text-ws-primary-700 uppercase tracking-wider mb-3">
                {pricingLabel}
              </div>
              <div className="flex items-end justify-center mb-2">
                <div className="text-6xl font-extrabold text-ws-text">
                  {pricingValue}
                </div>
                <div className="text-base font-medium text-ws-text-muted ml-2 mb-2">
                  / 7 days
                </div>
              </div>
              <div className="text-xs text-ws-text-subtle line-through mb-4 text-center">
                {pricingOriginal}
              </div>
              <div className="text-center">
                <span className="inline-block px-4 py-2 bg-ws-primary-50 text-ws-primary-700 text-xs font-bold uppercase tracking-wide rounded-full">
                  {pricingBadge}
                </span>
              </div>
            </div>

            {/* Middle Column - Features 1 & 2 */}
            {features.length >= 2 && (
              <div className="flex flex-col gap-4">
                {features.slice(0, 2).map((f, i) => (
                  <FeatureItem key={i} feature={f} />
                ))}
              </div>
            )}

            {/* Right Column - Features 3 & 4 */}
            {features.length >= 4 && (
              <div className="flex flex-col gap-4">
                {features.slice(2, 4).map((f, i) => (
                  <FeatureItem key={i} feature={f} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CTA Section */}
        <div className="flex flex-col md:flex-row items-center gap-4 justify-center max-w-2xl mx-auto">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder={inputPlaceholder}
              className="w-full px-6 py-5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ws-primary-400 focus:border-transparent"
              autoComplete="off"
            />
          </div>
          <a
            href={primaryCta.href}
            rel={primaryCta.external ? "noopener noreferrer" : undefined}
            target={primaryCta.external ? "_blank" : undefined}
            className="px-8 py-5 bg-primary text-primary-foreground font-bold text-base rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 whitespace-nowrap transition-colors"
          >
            {primaryCta.label}
          </a>
        </div>

        {/* Scroll Indicator */}
        <div className="mt-16 text-sm text-ws-text-subtle">&darr; Scroll to explore</div>
      </div>
    </section>
  );
}
