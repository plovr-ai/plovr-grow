interface FeatureCard {
  iconSvg: React.ReactNode;
  title: string;
  description: string;
}

interface AvaAdvantageProps {
  eyebrow?: string;
  title?: string;
  cards: FeatureCard[];
}

export function AvaAdvantage({
  eyebrow = "Meet \"Ava\", our AI agent.",
  title = "Industrial-Grade Reliability Meet Human-Like Warmth.",
  cards,
}: AvaAdvantageProps) {
  return (
    <section className="overflow-clip px-6 py-24 md:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col items-start gap-2">
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-[1.2px] text-[#ffbf00]">
              {eyebrow}
            </p>
          )}
          <h2 className="max-w-3xl text-3xl font-extrabold tracking-tight text-ws-text-heading md:text-5xl">
            {title}
          </h2>
        </div>

        {/* Cards grid */}
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.title}
              className="relative rounded-[32px] bg-ws-bg-card p-8"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[32px] border border-[rgba(212,197,171,0.1)]"
              />

              {/* Icon */}
              <div className="mb-6">{card.iconSvg}</div>

              {/* Title */}
              <h3 className="text-xl font-bold text-ws-text-heading">
                {card.title}
              </h3>

              {/* Description */}
              <p className="mt-2 text-sm leading-relaxed text-ws-text-body">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
