interface CostCard {
  iconSvg: React.ReactNode;
  iconBg: string;
  stat: string;
  statColor: string;
  description: string;
}

interface CostOfSilenceProps {
  title?: string;
  subtitle?: string;
  cards: CostCard[];
}

export function CostOfSilence({
  title = "The Cost of Silence",
  subtitle = "Every missed call is a customer lost to your competitor.",
  cards,
}: CostOfSilenceProps) {
  return (
    <section className="bg-ws-bg-card px-6 py-24 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-center text-3xl font-extrabold text-ws-text-heading md:text-5xl">
            {title}
          </h2>
          {subtitle && (
            <p className="max-w-xl text-center text-base text-ws-text-body">
              {subtitle}
            </p>
          )}
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.stat}
              className="relative flex flex-col rounded-[32px] bg-white p-10"
            >
              {/* Icon circle */}
              <div
                className={`flex size-14 items-center justify-center rounded-full ${card.iconBg}`}
              >
                {card.iconSvg}
              </div>

              {/* Stat */}
              <h3
                className={`mt-6 text-2xl font-extrabold md:text-4xl ${card.statColor}`}
              >
                {card.stat}
              </h3>

              {/* Description */}
              <p className="mt-4 text-base leading-relaxed text-ws-text-body">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
